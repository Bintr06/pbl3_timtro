import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet"
import "leaflet/dist/leaflet.css"

const center = [16.0739, 108.1499]

function formatPrice(price) {
  return price.toLocaleString("vi-VN") + " đ/tháng"
}

function MapView({ rooms }) {
  return (
    <div style={styles.wrapper}>
      <MapContainer
        center={center}
        zoom={15}
        style={styles.map}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {rooms?.map((room) => (
          <Marker key={room.id} position={[room.lat, room.lng]}>
            <Popup>
              <div style={styles.popup}>
                <img src={room.image} alt={room.title} style={styles.popupImg} />
                <h4 style={styles.popupTitle}>{room.title}</h4>
                <p style={styles.popupPrice}>{formatPrice(room.price)}</p>
                <p style={styles.popupAddress}>{room.address}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}

const styles = {
  wrapper: {
    background: "#fff",
    borderRadius: "12px",
    overflow: "hidden",
    boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
  },
  map: {
    width: "100%",
    height: "650px",
  },
  popup: {
    width: "220px",
  },
  popupImg: {
    width: "100%",
    height: "120px",
    objectFit: "cover",
    borderRadius: "8px",
    marginBottom: "8px",
  },
  popupTitle: {
    fontSize: "15px",
    marginBottom: "6px",
  },
  popupPrice: {
    color: "#d70018",
    fontWeight: "bold",
    marginBottom: "6px",
  },
  popupAddress: {
    fontSize: "13px",
    color: "#555",
    lineHeight: 1.4,
  },
}

export default MapView