const { GoogleGenerativeAI } = require("@google/generative-ai");

const API_KEY = "AIzaSyBQ-1wXPTy95HQrPmGYUGnfxcq6C6ZY9Vs";
const genAI = new GoogleGenerativeAI(API_KEY);

// Lista estendida com modelos de 2024 até as novidades de 2026
const modelosParaTestar = [
    "gemini-3.1-flash-lite", // Novidade 2026: Ultra rápido
    "gemini-3.1-pro",       // O mais inteligente de 2026
    "gemini-3-flash",       // Equilíbrio perfeito atual
    "gemini-2.5-flash",     // O que você pediu (Estável 2025)
    "gemini-2.5-flash-lite",// Versão econômica do 2.5
    "gemini-2.5-pro",       // Poderoso da geração 2.5
    "gemini-2.0-flash",     // O clássico da geração 2
    "gemini-2.0-flash-exp", // Experimental da geração 2
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash-8b",  // Excelente para dispositivos fracos
    "gemini-1.5-pro"
];

async function investigar() {
    console.log("\n🕵️ INVESTIGADOR DETETIVE v2.0 - VARREDURA DE ALTO NÍVEL");
    console.log("--------------------------------------------------");
    console.log("Verificando compatibilidade da sua chave API...\n");
    
    let disponiveis = [];

    for (const nomeModelo of modelosParaTestar) {
        process.stdout.write(`🔍 Verificando [${nomeModelo}]... `);
        try {
            const model = genAI.getGenerativeModel({ model: nomeModelo });
            // Teste simples de "pingo"
            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: 'Oi' }] }],
                generationConfig: { maxOutputTokens: 5 }
            });
            const response = await result.response;
            if (response.text()) {
                console.log("✅ ATIVO");
                disponiveis.push(nomeModelo);
            }
        } catch (error) {
            console.log("❌ INDISPONÍVEL");
        }
    }

    console.log("\n================ RELATÓRIO FINAL ================");
    if (disponiveis.length > 0) {
        console.log("🏆 MODELOS DISPONÍVEIS PARA VOCÊ:");
        disponiveis.forEach((m, i) => console.log(`${i+1}. ${m}`));
        
        console.log("\n💡 RECOMENDAÇÃO:");
        console.log(`Para seu Termux, o melhor é: "${disponiveis[0]}"`);
        console.log(`\nComando para configurar seu sentinela.js:`);
        console.log(`sed -i 's/model: ".*"/model: "${disponiveis[0]}"/' sentinela.js`);
    } else {
        console.log("❌ NENHUM MODELO COMPATÍVEL ENCONTRADO.");
        console.log("Sua chave pode ter expirado ou o Google mudou os nomes.");
    }
    console.log("==================================================\n");
}

investigar();
