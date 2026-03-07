export default function Home() {
  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        fontFamily: "sans-serif",
        gap: "25px",
        textAlign: "center"
      }}
    >
      <img
        src="/logo.png"
        style={{
          height: "140px"
        }}
      />

      <h1 style={{ fontSize: "34px" }}>
        Centro Sportivo Comun Nuovo
      </h1>

      <p>
        Il Barettino — Via Azzurri 2006
      </p>

      <a href="/prenota">
        <button
          style={{
            padding: "16px 35px",
            fontSize: "18px",
            borderRadius: "10px",
            cursor: "pointer",
            background: "#1f2937",
            color: "white",
            border: "none"
          }}
        >
          Prenota un campo
        </button>
      </a>

      <a href="/admin/calendario">
        <button
          style={{
            padding: "10px 20px",
            fontSize: "14px",
            borderRadius: "8px",
            cursor: "pointer"
          }}
        >
          Area amministrazione
        </button>
      </a>
    </main>
  );
}