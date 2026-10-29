import Logo from "./Logo.jsx";
import Icon from "./Icon.jsx";

export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="auth">
      <section className="auth-hero">
        <Logo size={44} light withText />
        <div className="auth-hero-body">
          <h1>Aide au diagnostic du cancer de la peau, <em>explicable</em>.</h1>
          <p>Une photo de la lésion et quelques données cliniques : le modèle multimodal DermLIP + clinique calcule
            une probabilité, montre où il a regardé et pourquoi. Le LLM local ne fait que reformuler.</p>
          <div className="auth-metrics">
            <div><b>0,947</b><span>AUC sur le test<br />(358 images jamais vues)</span></div>
            <div><b>96,8 %</b><span>sensibilité au<br />seuil de triage</span></div>
            <div><b>100 %</b><span>local : images et<br />LLM sur votre poste</span></div>
          </div>
          <ul className="auth-points">
            <li><Icon name="eye" size={16} /> Carte d'occlusion et contributions de chaque facteur</li>
            <li><Icon name="folder" size={16} /> Dossiers patients et suivi de l'évolution</li>
            <li><Icon name="chat" size={16} /> Assistant conversationnel ancré sur le modèle</li>
          </ul>
        </div>
        <div className="auth-hero-foot">PFA · Master Data Science &amp; Big Data · FSBM, Université Hassan II de Casablanca</div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <h2>{title}</h2>
          {subtitle && <p className="muted">{subtitle}</p>}
          {children}
        </div>
        <p className="auth-disclaimer">Outil de recherche : aide à la décision uniquement, il ne remplace ni l'examen clinique ni la biopsie.</p>
      </section>
    </div>
  );
}
