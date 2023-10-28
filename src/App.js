import React, { useState, useEffect, useRef } from "react";
import "./App.css";

import OpenAI from "openai";
const openai = new OpenAI({
  apiKey: process.env.REACT_APP_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

// Speech recognition settings
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;
const mic = new SpeechRecognition();
mic.continuous = true;
mic.interimResults = true;
mic.lang = "fr-FR";
mic.maxAlternatives = 2;

async function transcribeAudio(filename) {
  // let audioFile = new File([filename], "myaudio.ogg", {
  //   type: "audio/ogg; codecs=opus",
  // });
  console.log(filename);
  try {
    const transcript = await openai.audio.transcriptions.create({
      file: filename, //fs.createReadStream(filename),
      model: "whisper-1",
      language: "fr",
      prompt:
        "Ecrire correctement ces noms propres: Leonardo DiCaprio, Brad Pitt, Johnny Depp, Robert Downey Jr., Will Smith, Tom Hanks, Morgan Freeman, Samuel L. Jackson",
    });
    let processed = await gptPostProcessing(transcript.text);
    return processed;
  } catch (error) {
    console.error(error);
  }
}

async function gptPostProcessing(text) {
  console.log("text: ", text);
  try {
    const postProcessedText = await openai.completions.create({
      model: "gpt-3.5-turbo-instruct",
      prompt:
        text +
        "\nTu es un expert en prise de notes. Clarifie le texte précédent et revient à la ligne pour chaque idée distincte.",
      max_tokens: Math.floor(text.length / 2),
      temperature: 0.1,
    });
    console.log(postProcessedText.choices[0]);
    return postProcessedText.choices[0].text;
  } catch (error) {
    console.error(error);
  }
}

function App() {
  const [isListening, setIsListening] = useState(false);
  const [note, setNote] = useState(null);
  const [savedNotes, setSavedNotes] = useState([]);

  const audioChunk = useRef([]);
  const [recordings, setRecordings] = useState([]);
  const mediaRecorderRef = useRef(null);

  const startRec = async () => {
    console.log("Start to record");
    const options = {
      audio: true,
    };
    const stream = await navigator.mediaDevices.getUserMedia(options);
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        // save the data
        audioChunk.current.push(e.data);
      }
    };

    mediaRecorder.onstop = (e) => {
      console.log("End to record");
      const audioBlob = new Blob(audioChunk.current);
      // const audioUrl = URL.createObjectURL(audioBlob);
      // const audio = new Audio(audioUrl);
      const audioFile = new File([audioBlob], "audio.ogg", {
        type: "audio/ogg; codecs=opus",
      });
      setRecordings(audioFile);
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();
  };

  const stopRec = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();
    }
  };

  useEffect(() => {
    handleListen();
  }, [isListening]);

  const handleListen = () => {
    // recognition
    if (isListening) {
      mic.start();
      mic.onend = () => {
        console.log("continue...");
        mic.start();
      };

      // record
      startRec();
    } else {
      // recognition
      mic.stop();
      mic.onend = () => {
        console.log("Stopped Mic on Click");
      };

      // record
      stopRec();
    }
    mic.onstart = () => {
      console.log("Mics on");
    };
    mic.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0])
        .map((result) => result.transcript)
        .join("");
      console.log(transcript);
      setNote(transcript);
      mic.onerror = (event) => {
        console.log(event.error);
      };
    };
  };

  const handleSaveNote = async () => {
    setNote("");
    // Transcribe audio
    let transcribe = await transcribeAudio(recordings);
    console.log("Transcription>>>", transcribe);
    // setSavedNotes([...savedNotes, transcribe]);
    setSavedNotes([
      ...savedNotes,
      "SpeechAPI: " + note,
      "Whisper: " + transcribe,
    ]);
  };

  return (
    <>
      <h1>Voice Notes</h1>
      <div className="container">
        <div className="box">
          <h2>Current Note</h2>
          {isListening ? <span>🎙️</span> : <span>🛑🎙️</span>}
          <button onClick={handleSaveNote} disabled={!note}>
            Save Note
          </button>
          <button onClick={() => setIsListening((prevState) => !prevState)}>
            Start/Stop
          </button>
          <p>{note}</p>
          <div className="soundClips"></div>
        </div>
        <div className="box">
          <h2>Notes</h2>
          {savedNotes.map((n) => (
            <p key={n}>{n}</p>
          ))}
        </div>
      </div>
    </>
  );
}

// {recordings.map((recUrl, index) => {
//   return (
//     <div key={index}>
//       <audio controls src={recUrl} />
//       <a href={recUrl} download={`recording-${index}.ogg`}>
//         Download
//       </a>
//     </div>
//   );
// })}

export default App;
