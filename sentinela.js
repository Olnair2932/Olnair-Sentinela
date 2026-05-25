require('dotenv').config();
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");
let serviceAccount; if (process.env.FIREBASE_CONFIG_JSON) { serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG_JSON); } else { serviceAccount = {}; console.error("⚠️ AVISO: Nenhuma credencial encontrada!"); }

if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: "https://minhaiamemoria-default-rtdb.firebaseio.com"
    });
}

const db = admin.firestore();
const rtdb = admin.database();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);

const model = genAI.getGenerativeModel({ 
    model: "gemini-3.1-flash-lite",
    systemInstruction: "Você é o Sentinela v3.2. Olnair é seu desenvolvedor. Use Markdown em suas respostas. Você é o Amigo Fiel de Porto Alegre com memória unificada."
});

// FUNÇÃO DE SANITIZAÇÃO (Mantém apenas as últimas 100 mensagens no Firestore)
async function manterHistoricoLimpo() {
    try {
        const snapshot = await db.collection("historico").orderBy("data", "asc").get();
        if (snapshot.size > 100) {
            const excesso = snapshot.size - 100;
            const batch = db.batch(); // Usa batch para deletar vários de uma vez
            for (let i = 0; i < excesso; i++) {
                batch.delete(snapshot.docs[i].ref);
            }
            await batch.commit();
            console.log(`🧹 Limpeza: ${excesso} registros antigos removidos.`);
        }
    } catch (e) { console.error("⚠️ Erro na limpeza:", e.message); }
}

console.log("🚀 SENTINELA v3.2 ONLINE - Com Auto-Limpeza de Memória");

const queueRef = rtdb.ref('fila_entrada');

queueRef.on('child_added', async (snapshot) => {
    const idComando = snapshot.key;
    const dados = snapshot.val();
    const pergunta = dados.texto;
    const origem = dados.origem || "desconhecida";

    if (!pergunta) return;

    console.log(`\n📩 [${origem.toUpperCase()}] Pergunta: ${pergunta}`);

    try {
        // BUSCAR MEMÓRIA GLOBAL (Últimas 20 para contexto)
        const snapshotMemoria = await db.collection("historico").orderBy("data", "asc").limitToLast(20).get();
        let memoria = [];
        snapshotMemoria.forEach(doc => {
            memoria.push({ role: doc.data().role, parts: [{ text: doc.data().text }] });
        });

        // PROCESSAMENTO COM FALLBACK
        let result;
        try {
            const chat = model.startChat({ history: memoria });
            result = await chat.sendMessage(pergunta);
        } catch (err) {
            console.log("⚠️ Modelo principal ocupado, tentando Backup...");
            const modelBackup = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const chatBackup = modelBackup.startChat({ history: memoria });
            result = await chatBackup.sendMessage(pergunta);
        }

        const resposta = result.response.text();

        // SALVAR NO FIRESTORE E EXECUTAR LIMPEZA
        const agora = Date.now();
        await db.collection("historico").add({ role: "user", text: pergunta, data: agora, origem: origem });
        await db.collection("historico").add({ role: "model", text: resposta, data: agora + 1, origem: "sentinela" });
        
        await manterHistoricoLimpo(); // <--- CHAMA A LIMPEZA AQUI

        // ENVIAR RESPOSTA PARA O SITE (Corrigido com /)
        await rtdb.ref('respostas/' + idComando).set({ texto: resposta, data: agora });

        // REMOVER DA FILA
        await snapshot.ref.remove();
        console.log(`✅ Sucesso [ID: ${idComando}]`);

    } catch (e) {
        console.error("❌ Erro fatal:", e.message);
        await rtdb.ref('respostas/' + idComando).set({ texto: "Instabilidade técnica. Tente de novo.", data: Date.now() });
        await snapshot.ref.remove();
    }
});
