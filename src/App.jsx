import React, { useState, useEffect, useRef } from "react";
import axios from "axios";

const initialState = {
  messages: [],
  question: "",
  answer: "",
  generatingAnswer: false,
  isSpeaking: false,
  isListening: false,
  autoListening: false,
  recognitionError: "",
};

const App = () => {
  const [state, setState] = useState(initialState);
  const recognition = useRef(null);
  const speechSynthesisRef = useRef(null);
  const formRef = useRef(null);
  const debounceTimer = useRef(null);

  const {
    question,
    answer,
    generatingAnswer,
    isSpeaking,
    isListening,
    autoListening,
    messages,
  } = state;

  useEffect(() => {
    setupSpeechRecognition();
    return () => {
      if (recognition.current) {
        recognition.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    if (autoListening && !isListening) {
      recognition.current.start();
    }
  }, [autoListening]);

  const setupSpeechRecognition = () => {
    const recognitionInstance = new window.webkitSpeechRecognition();
    recognitionInstance.continuous = true;
    recognitionInstance.lang = "en-US";
    recognitionInstance.interimResults = false;

    recognitionInstance.onstart = () => {
      setState((prevState) => ({
        ...prevState,
        isListening: true,
        recognitionError: "",
      }));
    };

    recognitionInstance.onresult = handleRecognitionResult;

    recognitionInstance.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setState((prevState) => ({
        ...prevState,
        recognitionError: "Failed to recognize speech.",
        autoListening: false, // Disable auto listening on error
      }));
      if (recognition.current) {
        recognition.current.stop(); // Stop recognition on error
      }
    };

    recognitionInstance.onend = () => {
      setState((prevState) => ({ ...prevState, isListening: false }));
      if (autoListening) {
        recognitionInstance.start();
      }
    };

    recognition.current = recognitionInstance;
  };

  const handleRecognitionResult = async (event) => {
    const transcript = event.results[event.resultIndex][0].transcript.trim();
    setState((prevState) => ({ ...prevState, question: transcript }));

    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      formRef.current.dispatchEvent(
        new Event("submit", { cancelable: true, bubbles: true })
      );
    }, 100);
  };

  const generateAnswer = async (e) => {
    if (e) e.preventDefault();
    if (!question) return; // Prevent empty submissions

    setState((prevState) => ({ ...prevState, generatingAnswer: true }));

    try {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${
          import.meta.env.VITE_API_GENERATIVE_LANGUAGE_CLIENT
        }`,
        {
          contents: [{ parts: [{ text: question }] }],
        }
      );

      const generatedAnswer =
        response.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        "Sorry - Something went wrong. Please try again!";

      setState((prevState) => ({
        ...prevState,
        answer: generatedAnswer,
        generatingAnswer: false,
        messages: [
          ...prevState.messages,
          { text: question, isUser: true },
          { text: generatedAnswer, isUser: false },
        ],
        question: "",
      }));

      speakAnswer(generatedAnswer);
    } catch (error) {
      console.error("Error generating answer:", error);
      setState((prevState) => ({
        ...prevState,
        answer: "Sorry - Something went wrong. Please try again!",
        generatingAnswer: false,
      }));
    }
  };

  const speakAnswer = (text) => {
    if (recognition.current) {
      recognition.current.stop();
    }

    const speech = new SpeechSynthesisUtterance(text);
    speechSynthesisRef.current = speech;
    speech.onend = () => {
      setState((prevState) => ({ ...prevState, isSpeaking: false }));
      if (autoListening) {
        recognition.current.start();
      }
    };

    window.speechSynthesis.speak(speech);
    setState((prevState) => ({ ...prevState, isSpeaking: true }));
  };

  const stopSpeech = () => {
    if (speechSynthesisRef.current) {
      window.speechSynthesis.cancel();
      setState((prevState) => ({
        ...prevState,
        isSpeaking: false,
        autoListening: false,
      })); // Disable auto listening when stopping
    }
  };

  const toggleListening = () => {
    if (isListening) {
      recognition.current.stop();
      setState((prevState) => ({
        ...prevState,
        isListening: false,
        autoListening: false,
      })); // Disable both
    } else {
      recognition.current.start();
      setState((prevState) => ({
        ...prevState,
        isListening: true,
        autoListening: true,
      })); // Enable both
    }
  };

  const toggleAutoListening = () => {
    setState((prevState) => ({
      ...prevState,
      autoListening: !prevState.autoListening,
      isListening: prevState.autoListening ? false : prevState.isListening, // Disable listening if toggling auto listening off
    }));
    if (recognition.current) {
      if (prevState.autoListening) {
        recognition.current.stop();
      } else {
        recognition.current.start();
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-purple-800 to-black text-white">
      <div className="p-4 shadow-md bg-purple-900 rounded-lg">
        <h1 className="text-3xl font-bold text-center">The VoiceFlow</h1>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <div className="flex flex-col items-start mt-4 space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`max-w-md rounded-lg p-4 shadow-md ${
                message.isUser
                  ? "bg-purple-600 text-white self-end"
                  : "bg-gray-700 text-white"
              }`}
            >
              <p className="text-sm">{message.text}</p>
            </div>
          ))}
        </div>
      </div>
      <form
        ref={formRef}
        onSubmit={generateAnswer}
        className="bg-purple-800 p-4 shadow-md flex items-center rounded-lg"
      >
        <input
          required
          type="text"
          className="flex-1 border border-gray-300 rounded-lg p-3 mr-4 resize-none bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          value={question}
          onChange={(e) =>
            setState((prevState) => ({
              ...prevState,
              question: e.target.value,
            }))
          }
          placeholder="Type your message..."
        />
        <button
          type="submit"
          className="bg-purple-700 px-5 py-2 text-white rounded-lg shadow-md hover:bg-purple-800 transition-all duration-300"
          disabled={generatingAnswer}
        >
          {generatingAnswer ? (
            <div className="flex items-center justify-center">
              <div className="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-6 w-6 mb-3"></div>
            </div>
          ) : (
            "Send"
          )}
        </button>
      </form>
      <div className="bg-purple-800 p-4 shadow-md flex justify-center items-center rounded-lg">
        <button
          onClick={toggleListening}
          className={`bg-purple-700 text-white py-2 px-4 rounded-lg shadow-md transition-all duration-300 ${
            isListening
              ? "opacity-50 cursor-not-allowed"
              : "hover:bg-purple-800"
          }`}
        >
          {isListening ? "Listening..." : "Start Listening"}
        </button>
        {isSpeaking && (
          <button
            onClick={stopSpeech}
            className="ml-4 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg shadow-md transition-all duration-300"
          >
            Stop
          </button>
        )}
        <button
          onClick={toggleAutoListening}
          className={`ml-4 bg-green-600 text-white py-2 px-4 rounded-lg shadow-md transition-all duration-300 ${
            autoListening ? "bg-green-700" : "hover:bg-green-500"
          }`}
          disabled={isListening}
        >
          {autoListening ? "Auto Listening On" : "Auto Listening Off"}
        </button>
      </div>
      {state.recognitionError && (
        <p className="text-red-400 mt-2 text-center">
          {state.recognitionError}
        </p>
      )}
      {generatingAnswer && (
        
        <div className="fixed top-0 left-0 w-full h-full flex items-center justify-center bg-gray-800 bg-opacity-50">
          <span className="loading loading-bars loading-xs"></span>
          <span className="loading loading-bars loading-sm"></span>
          <span className="loading loading-bars loading-md"></span>
          <span className="loading loading-bars loading-lg"></span>
        </div>
      )}
    </div>
  );
};

export default App;
