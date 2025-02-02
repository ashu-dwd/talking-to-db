import { useState } from "react";
import "./App.css"; // Make sure to add styles for the chat layout

export default function App() {
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [responses, setResponses] = useState([]); // Store multiple responses

  const handleUserQuery = async () => {
    setLoading(true);
    setMsg("");
    console.log(msg);

    // Add user message to the chat
    setResponses((prevResponses) => [
      ...prevResponses,
      { sender: "user", message: msg },
    ]);

    try {
      const res = await fetch("http://localhost:3000/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: msg }),
      });

      if (!res.ok) {
        throw new Error("Network response was not ok");
      }

      const responseData = await res.json();
      console.log(responseData);

      // Add response to the chat (rendering HTML)
      setResponses((prevResponses) => [
        ...prevResponses,
        { sender: "ai", message: responseData.data || responseData.message },
      ]);
    } catch (error) {
      console.error("Error:", error);
      setResponses((prevResponses) => [
        ...prevResponses,
        { sender: "ai", message: "Something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-app">
      <div className="chat-window">
        <div className="chat-header">
          <h2>Talk To Database</h2>
        </div>
        <div className="chat-messages">
          {responses.map((response, index) => (
            <div
              key={index}
              className={`message ${
                response.sender === "user" ? "user-msg" : "ai-msg"
              }`}
            >
              {response.sender === "user" ? (
                <p>{response.message}</p>
              ) : (
                <div
                  dangerouslySetInnerHTML={{ __html: response.message }}
                ></div>
              )}
            </div>
          ))}
        </div>
        <div className="chat-footer">
          <input
            type="text"
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            placeholder="Type a message"
            autoComplete="off"
            required
          />
          <button
            onClick={handleUserQuery}
            disabled={loading || !msg.trim()}
            className={loading ? "loading" : ""}
          >
            {loading ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
