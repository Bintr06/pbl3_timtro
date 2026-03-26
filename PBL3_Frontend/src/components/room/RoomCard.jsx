function formatPrice(price) {
  return price.toLocaleString("vi-VN") + " đ/tháng"
}

function RoomCard({ room }) {
  return (
    <div style={styles.card}>
      <img src={room.image} alt={room.title} style={styles.image} />

      <div style={styles.content}>
        <h3 style={styles.title}>{room.title}</h3>

        <p style={styles.price}>{formatPrice(room.price)}</p>

        <p style={styles.meta}>
          {room.area} m² • {room.address}
        </p>

        <button style={styles.button}>Xem chi tiết</button>
      </div>
    </div>
  )
}

const styles = {
  card: {
    display: "grid",
    gridTemplateColumns: "180px 1fr",
    background: "#fff",
    borderRadius: "12px",
    overflow: "hidden",
    boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
    marginBottom: "14px",
  },
  image: {
    width: "100%",
    height: "100%",
    minHeight: "145px",
    objectFit: "cover",
  },
  content: {
    padding: "14px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  title: {
    fontSize: "18px",
    fontWeight: "bold",
    lineHeight: 1.4,
  },
  price: {
    color: "#d70018",
    fontWeight: "bold",
    fontSize: "18px",
  },
  meta: {
    color: "#666",
    fontSize: "14px",
    lineHeight: 1.5,
  },
  button: {
    marginTop: "8px",
    color: "#fff",
    width: "fit-content",
    background: "#1077b7",
    border: "none",
    padding: "10px 14px",
    borderRadius: "8px",
    fontWeight: "bold",
  },
}

export default RoomCard