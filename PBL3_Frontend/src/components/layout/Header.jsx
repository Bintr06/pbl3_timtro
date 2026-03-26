import { Link } from "react-router-dom"

function Header() {
  return (
    <header style={styles.header}>
      <div style={styles.container}>
        <Link to="/" style={styles.logo}>
          FindRoom
        </Link>

        <div style={styles.actions}>
          <Link to="/login" style={styles.link}>
            Đăng nhập
          </Link>

          <Link to="/chat" style={styles.link}>
            Tin nhắn
          </Link>

          <Link to="/post-room" style={styles.postButton}>
            Đăng tin
          </Link>
        </div>
      </div>
    </header>
  )
}

const styles = {
  header: {
    background: "#2c61a7",
    borderBottom: "1px solid #335bc7",
  },
  container: {
    maxWidth: "1400px",
    margin: "0 auto",
    padding: "14px 16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logo: {
    fontSize: "32px",
    fontWeight: "bold",
    color: "#ffffff",
  },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },
  link: {
    color: "#ffffff",
    fontWeight: 500,
  },
  postButton: {
    background: "#ffffff",
    color: "#5481e3",
    padding: "10px 16px",
    borderRadius: "8px",
    fontWeight: "bold",
  },
}

export default Header