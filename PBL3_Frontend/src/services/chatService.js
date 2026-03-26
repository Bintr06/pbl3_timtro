import api from "./api"

export const getMessages = async () => {

  const res = await api.get("/messages")

  return res.data
}