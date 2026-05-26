require('dotenv').config();
const http = require("http");
const server = http.createServer((req, res) => { res.writeHead(200, { "Content-Type": "text/plain" }); res.end("Sentinela Online!"); });
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(\`Servidor de porta \${PORT} iniciado.\`); });

const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// INICIALIZAÇÃO ROBUSTA
const firebaseConfig = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : ""
};

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(firebaseConfig),
        databaseURL: "https://minhaiamemoria-default-rtdb.firebaseio.com"
    });
}

const db = admin.firestore();
const rtdb = admin.database();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);

const model = genAI.getGenerativeModel({
    model: "gemini-3.1-flash-lite",
    systemInstruction: "Você é o Sentinela. Olnair é seu desenvolvedor. Use Markdown em suas respostas. Você é o Amigo Fiel de Porto Alegre com memória unificada."
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

console.log("🚀 SENTINELA ONLINE - Status Ativo");

// Monitor de Reset Remoto

// Monitor de Limpeza Remota

// Monitor de Limpeza Remota

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
// Monitor de Controle Centralizado
rtdb.ref("controle").on("value", async (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    if (data.limpar === true) {
        console.log("🧹 LIMPEZA REMOTA RECEBIDA! Apagando histórico...");
        const docs = await db.collection("historico").get();
        const batch = db.batch();
        docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        await rtdb.ref("controle/limpar").set(false);
        console.log("✅ Histórico limpo com sucesso.");
    }

    if (data.reset === true) {
        console.log("⚠️ RESET REMOTO RECEBIDO! Reiniciando...");
        await rtdb.ref("controle/reset").set(false);
        process.exit(1);
    }
});
