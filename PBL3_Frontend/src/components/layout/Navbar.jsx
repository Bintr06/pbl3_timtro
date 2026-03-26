import { Link } from "react-router-dom"

function Navbar() {
  return (
    <nav style={styles.nav}>
      <div style={styles.container}>
        <Link to="/" style={styles.item}>Trang chủ</Link>
        <Link to="/" style={styles.item}>Phòng trọ</Link>
        <Link to="/" style={styles.item}>Căn hộ mini</Link>
        <Link to="/" style={styles.item}>Ở ghép</Link>
      </div>
    </nav>
  )
}

const styles = {
  nav: {
    background: "#fff",
    borderBottom: "1px solid #e5e7eb",
  },
  container: {
    maxWidth: "1400px",
    margin: "0 auto",
    padding: "10px 16px",
    display: "flex",
    gap: "20px",
  },
  item: {
    color: "#444",
    fontSize: "15px",
    fontWeight: 500,
  },
}

export default Navbar