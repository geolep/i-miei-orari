import React from "react";

export default function TerminiPage() {
  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold mb-4">Termini di Servizio</h1>
      <p className="mb-2">Utilizzando questa applicazione, accetti i seguenti termini e condizioni. L'applicazione è fornita "così com'è" senza alcuna garanzia. L'utente è responsabile dell'utilizzo dei dati inseriti e delle informazioni visualizzate.</p>
      <p className="mb-2">Ci riserviamo il diritto di modificare i termini in qualsiasi momento. Le modifiche saranno comunicate tramite l'applicazione.</p>
      <p className="text-xs text-muted-foreground mt-6">Ultimo aggiornamento: {new Date().toLocaleDateString()}</p>
    </div>
  );
} 