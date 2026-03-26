import { useMemo, useState } from "react"
import Header from "../../components/layout/Header"
import Navbar from "../../components/layout/Navbar"
import SearchBar from "../../components/search/SearchBar"
import RoomList from "../../components/room/RoomList"
import MapView from "../../components/map/MapView"

function Home() {
  const initialRooms = [
    {
      id: 1,
      title: "Phòng trọ gần Đại học Bách Khoa Đà Nẵng",
      price: 2200000,
      area: 20,
      address: "Ngô Sĩ Liên, Hòa Khánh Bắc, Liên Chiểu, Đà Nẵng",
      image: "https://picsum.photos/400/250?random=1",
      lat: 16.0739,
      lng: 108.1499,
    },
    {
      id: 2,
      title: "Phòng full nội thất, gần ký túc xá",
      price: 2800000,
      area: 25,
      address: "Hòa Minh, Liên Chiểu, Đà Nẵng",
      image: "https://picsum.photos/400/250?random=2",
      lat: 16.0752,
      lng: 108.1525,
    },
    {
      id: 3,
      title: "Phòng trọ sạch sẽ, giờ giấc tự do",
      price: 1800000,
      area: 18,
      address: "Nguyễn Lương Bằng, Liên Chiểu, Đà Nẵng",
      image: "https://picsum.photos/400/250?random=3",
      lat: 16.0726,
      lng: 108.1478,
    },
    {
      id: 4,
      title: "Căn hộ mini gần chợ, có máy lạnh",
      price: 3200000,
      area: 30,
      address: "Tôn Đức Thắng, Liên Chiểu, Đà Nẵng",
      image: "https://picsum.photos/400/250?random=4",
      lat: 16.078,
      lng: 108.1508,
    },
  ]

  const [rooms] = useState(initialRooms)
  const [keyword, setKeyword] = useState("")
  const [priceFilter, setPriceFilter] = useState("all")

  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      const matchKeyword =
        room.title.toLowerCase().includes(keyword.toLowerCase()) ||
        room.address.toLowerCase().includes(keyword.toLowerCase())

      let matchPrice = true

      if (priceFilter === "under2m") {
        matchPrice = room.price < 2000000
      } else if (priceFilter === "2to3m") {
        matchPrice = room.price >= 2000000 && room.price <= 3000000
      } else if (priceFilter === "over3m") {
        matchPrice = room.price > 3000000
      }

      return matchKeyword && matchPrice
    })
  }, [rooms, keyword, priceFilter])

  return (
    <div>
      <Header />
      <Navbar />

      <div style={styles.page}>
        <SearchBar
          keyword={keyword}
          onKeywordChange={setKeyword}
          priceFilter={priceFilter}
          onPriceFilterChange={setPriceFilter}
        />

        <div style={styles.content}>
          <div style={styles.leftColumn}>
            <div style={styles.resultHeader}>
              <h2 style={styles.resultTitle}>Danh sách phòng trọ</h2>
              <span style={styles.resultCount}>
                {filteredRooms.length} kết quả
              </span>
            </div>

            <RoomList rooms={filteredRooms} />
          </div>

          <div style={styles.rightColumn}>
            <MapView rooms={filteredRooms} />
          </div>
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: {
    maxWidth: "1400px",
    margin: "0 auto",
    padding: "16px",
  },
  content: {
    display: "grid",
    gridTemplateColumns: "1.2fr 1fr",
    gap: "16px",
    alignItems: "start",
  },
  leftColumn: {
    minWidth: 0,
  },
  rightColumn: {
    position: "sticky",
    top: "16px",
  },
  resultHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
  },
  resultTitle: {
    fontSize: "22px",
    fontWeight: "bold",
  },
  resultCount: {
    color: "#666",
    fontSize: "14px",
  },
}

export default Home