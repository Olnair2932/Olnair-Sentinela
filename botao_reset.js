// Adicionar ao topo do script (importações)
import { set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Função de reset
window.resetarSentinela = () => {
    if(confirm("Deseja realmente reiniciar o Sentinela?")) {
        set(ref(rtdb, 'controle/reset'), true);
        alert("Comando de reset enviado!");
    }
};
