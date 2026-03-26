import { useState } from "react"
import { createRoom } from "../../services/roomService"

function PostRoom(){

  const [title,setTitle]=useState("")
  const [price,setPrice]=useState("")

  const handleSubmit = async ()=>{

    await createRoom({
      title,
      price
    })

    alert("Posted")

  }

  return(

    <div>

      <input
        placeholder="Title"
        onChange={(e)=>setTitle(e.target.value)}
      />

      <input
        placeholder="Price"
        onChange={(e)=>setPrice(e.target.value)}
      />

      <button onClick={handleSubmit}>
        Post
      </button>

    </div>

  )
}

export default PostRoom