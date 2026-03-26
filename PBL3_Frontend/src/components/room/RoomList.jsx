import RoomCard from "./RoomCard"

function RoomList({ rooms }) {
  if (!rooms || rooms.length === 0) {
    return (
      <div style={styles.emptyBox}>
        <h3>Không tìm thấy phòng phù hợp</h3>
        <p>Hãy thử đổi từ khóa hoặc mức giá.</p>
      </div>
    )
  }

  return (
    <div>
      {rooms.map((room) => (
        <RoomCard key={room.id} room={room} />
      ))}
    </div>
  )
}

const styles = {
  emptyBox: {
    background: "#fff",
    borderRadius: "12px",
    padding: "32px",
    textAlign: "center",
    boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
    color: "#555",
    lineHeight: 1.8,
  },
}

export default RoomList