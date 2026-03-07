export default function Home() {
  return (
    <main style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "100vh",
      fontFamily: "sans-serif",
      gap: "20px"
    }}>

      <h1 style={{fontSize:"36px"}}>
        Centro Sportivo Comun Nuovo
      </h1>

      <p>
        Prenotazione campi online
      </p>

      <a href="/prenota">
        <button style={{
          padding:"15px 30px",
          fontSize:"18px",
          borderRadius:"10px",
          cursor:"pointer"
        }}>
          Prenota un campo
        </button>
      </a>

      <a href="/admin/calendario">
        <button style={{
          padding:"10px 20px",
          fontSize:"14px",
          borderRadius:"8px",
          cursor:"pointer"
        }}>
          Area amministrazione
        </button>
      </a>

    </main>
  )
}