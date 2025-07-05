import React from "react";

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold mb-4">Privacy Policy</h1>
      <p className="mb-2">La tua privacy è importante per noi. Questa applicazione raccoglie e tratta i dati personali nel rispetto delle normative vigenti. Nessun dato verrà condiviso con terze parti senza il tuo consenso esplicito.</p>
      <p className="mb-2">Per maggiori informazioni o richieste riguardanti i tuoi dati personali, contattaci all'indirizzo email fornito nell'applicazione.</p>
      <p className="text-xs text-muted-foreground mt-6">Ultimo aggiornamento: {new Date().toLocaleDateString()}</p>
    </div>
  );
} 