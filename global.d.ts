// Extending the Window interface
interface Window {
    SpeechRecognition?: typeof SpeechRecognition;
    webkitSpeechRecognition?: typeof SpeechRecognition;
    SpeechGrammarList?: typeof SpeechGrammarList; 
    webkitSpeechGrammarList?: typeof SpeechGrammarList;
    speechRecognitionConfig?: {
      grammars: SpeechGrammarList;
      lang: string;
      maxAlternatives: number;
    };
  }
  
  // Add these declarations if you get TypeScript errors
  declare class SpeechGrammarList {
    constructor();
    public addFromString(string: string, weight?: number): void;
    public addFromURI(src: string, weight?: number): void;
    public item(index: number): string;
    public readonly length: number;
  }
  
  // Extend the SpeechRecognition interface from react-speech-recognition
  declare namespace SpeechRecognition {
    function getRecognition(): any;
  }