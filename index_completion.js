    // Master Extended Translation Dictionary Matrix Block Assembly
    const extendedDictionary = {
      EN: {
        checkpoint: "SECURITY CHECKPOINT", subtext: "Global Governance & Energy Fleet Authorization Protocol",
        card1Title: "1. SaaS Financial Rails", card1Sub: "Corporate Ledger Balance (United Bank)", card1Btn: "Simulate Stripe Payout Clearing",
        card2Title: "2. Demand Response Arbitrage", card2SubA: "Utility Incentives", card2SubB: "Load Curtailed", card2Btn: "Inject National Grid DR Signal",
        card3Title: "3. Sustainability Audit", card4Title: "4. IoT Edge Ingress Broker (1883)", card5Title: "5 & 6. Agentic ML Scaffolder Core", card5Btn: "Trigger Agent Blackwell Compilation"
      },
      ES: {
        checkpoint: "PUNTO DE SEGURIDAD", subtext: "Protocolo de Autorización de Gobernanza Global y Flota de Energía",
        card1Title: "1. Carriles Financieros SaaS", card1Sub: "Saldo del Libro Mayor Corporativo (United Bank)", card1Btn: "Simular Liquidación de Pagos de Stripe",
        card2Title: "2. Arbitraje de Respuesta a la Demanda", card2SubA: "Incentivos de Servicios", card2SubB: "Carga Reducida", card2Btn: "Inyectar Sinal DR de la Red Nacional",
        card3Title: "3. Auditoría de Sostenibilidad", card4Title: "4. Agente de Entrada IoT Edge (1883)", card5Title: "5 & 6. Núcleo do Desenvolvedor Agentic ML", card5Btn: "Disparar Compilação de Blackwell do Agente"
      },
      FR: {
        checkpoint: "POINT DE CONTRÔLE SÉCURITÉ", subtext: "Protocole d'Autorisation de la Flotte d'Énergie et de la Gouvernance Globale",
        card1Title: "1. Rails Financiers SaaS", card1Sub: "Solde du Grand Livre Entreprise (United Bank)", card1Btn: "Simuler la Compensation des Paiements Stripe",
        card2Title: "2. Arbitrage de Réponse à la Demande", card2SubA: "Incitations Services Publics", card2SubB: "Charge Réduite", card2Btn: "Injecter le Signal DR du Réseau National",
        card3Title: "3. Audit de Durabilité", card4Title: "4. Courtier d'Entrée IoT Edge (1883)", card5Title: "5 & 6. Noyau de l'Échafaud

cat << 'EOF' > index_remainder.js
      FR: {
        checkpoint: "POINT DE CONTRÔLE SÉCURITÉ", subtext: "Protocole d'Autorisation de la Flotte d'Énergie et de la Gouvernance Globale",
        card1Title: "1. Rails Financiers SaaS", card1Sub: "Solde du Grand Livre Entreprise (United Bank)", card1Btn: "Simuler la Compensation des Paiements Stripe",
        card2Title: "2. Arbitrage de Réponse à la Demande", card2SubA: "Incitations Services Publics", card2SubB: "Charge Réduite", card2Btn: "Injecter le Signal DR du Réseau National",
        card3Title: "3. Audit de Durabilité", card4Title: "4. Courtier d'Entrée IoT Edge (1883)", card5Title: "5 & 6. Noyau de l'Échafaudage Agentic ML", card5Btn: "Déclencher la Compilation de l'Agent Blackwell"
      },
      DE: {
        checkpoint: "SICHERHEITSKONTROLLPUNKT", subtext: "Globales Governance- und Energieflotten-Autorisierungsprotokoll",
        card1Title: "1. SaaS-Finanzschienen", card1Sub: "Unternehmenshauptbuch-Saldo (United Bank)", card1Btn: "Stripe-Auszahlungsabwicklung Simulieren",
        card2Title: "2. Lastmanagement-Arbitrage", card2SubA: "Versorgungsanreize", card2SubB: "Reduzierte Last", card2Btn: "Nationales Netz-DR-Signal Injezieren",
        card3Title: "3. Nachhaltigkeitsprüfung", card4Title: "4. IoT-Edge-Ingress-Broker (1883)", card5Title: "5 & 6. Agentic ML Scaffolder-Kern", card5Btn: "Agenten-Blackwell-Kompilierung Auslösen"
      },
      JA: {
        checkpoint: "セキュリティ・チェックポイント", subtext: "グローバル・ガバナンス＆エネルギー・フリート承認プロトコル",
        card1Title: "1. SaaS金融システム・レール", card1Sub: "企業元帳残高 (ユナイテッド銀行)", card1Btn: "Stripeペイアウト決済をシミュレート",
        card2Title: "2. デマンドレスポンス・裁定取引", card2SubA: "ユーティリティ・インセンティブ", card2SubB: "削減された負荷容量", card2Btn: "国営グリッドDRシグナルを注入",
        card3Title: "3. サステナビリティ監査", card4Title: "4. IoTエッジ・イングレス・ブローカー (1883)", card5Title: "5 & 6. エージェント型MLスキャフォーダ・コア", card5Btn: "エージェント・ブラックウェル・コンパイルを実行"
      },
      PT: {
        checkpoint: "PONTO DE SEGURANÇA", subtext: "Protocolo de Autorização de Governança Global e Frota de Energia",
        card1Title: "1. Trilhos Financeiros SaaS", card1Sub: "Saldo do Razão Corporativo (United Bank)", card1Btn: "Simular Compensação de Pagamento Stripe",
        card2Title: "2. Arbitrage de Resposta à Demanda", card2SubA: "Incentivos de Serviços Públicos", card2SubB: "Carga Reducida", card2Btn: "Injetar Sinal DR da Rede Nacional",
        card3Title: "3. Auditoria de Sustentabilidade", card4Title: "4. Corretor de Entrada IoT Edge (1883)", card5Title: "5 & 6. Nós do Andaime Agentic ML", card5Btn: "Acionar Compilação do Agente Blackwell"
      }
    };

    function toggleExtendedLanguage(lang) {
      const dict = extendedDictionary[lang];
      if (!dict) return;
      localStorage.setItem("preferred_lang", lang);

      const h2G = document.querySelector("#view-gateway h2"); if (h2G) h2G.innerText = dict.checkpoint;
      const pG = document.querySelector("#view-gateway p"); if (pG) pG.innerText = dict.subtext;

      const cards = document.querySelectorAll("#view-dashboard main .holo-card h3");
      if (cards.length >= 5) {
        cards[0].innerText = dict.card1Title; cards[1].innerText = dict.card2Title;
        cards[2].innerText = dict.card3Title; cards[3].innerText = dict.card4Title; cards[4].innerText = dict.card5Title;
      }

      const btnFinancial = document.querySelector("button[onClick='triggerPaymentSimulation()']"); if (btnFinancial) btnFinancial.innerText = dict.card1Btn;
      const btnDR = document.querySelector("button[onClick='triggerDemandResponse()']"); if (btnDR) btnDR.innerText = dict.card2Btn;
      const btnAgent = document.querySelector("button[onClick='fireAgentCompute()']"); if (btnAgent) btnAgent.innerText = dict.card5Btn;

      appendTerminalLog(`System language catalog context re-mapped to standard: [${lang}]`, "var(--clr-solar-amber)");
    }

    // Dynamic wallet restoration check on soft refreshing loop profiles
    setTimeout(() => {
      const activeUser = localStorage.getItem("user_email");
      const storedBalance = localStorage.getItem("current_wallet_balance");
      if (activeUser && storedBalance) {
        const balanceBox = document.getElementById("txt-ledger-balance");
        if (balanceBox) balanceBox.innerText = `$${parseFloat(storedBalance).toFixed(2)}`;
      }
    }, 50);

    window.addEventListener("DOMContentLoaded", renderActiveViews);
  </script>
</body>
</html>
