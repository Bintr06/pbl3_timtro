import api from "./api"

export const getRooms = async (keyword) => {

  const res = await api.get("/rooms", {
    params: {
      search: keyword
    }
  })

  return res.data
}