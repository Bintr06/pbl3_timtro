import { useState, useEffect } from "react"
import useSocket from "../../hooks/useSocket"

function ChatBox() {

  const socket = useSocket()

  const [messages,setMessages] = useState([])
  const [message,setMessage] = useState("")

  useEffect(()=>{

    if(!socket) return

    socket.on("message",(msg)=>{
      setMessages(prev=>[...prev,msg])
    })

  },[socket])

  const sendMessage=()=>{

    socket.emit("message",message)

    setMessages([...messages,message])

    setMessage("")
  }

  return(

    <div>

      {messages.map((m,i)=>(
        <p key={i}>{m}</p>
      ))}

      <input
        value={message}
        onChange={(e)=>setMessage(e.target.value)}
      />

      <button onClick={sendMessage}>
        Send
      </button>

    </div>
  )
}

export default ChatBox