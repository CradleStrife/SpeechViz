import React from 'react';
import './App.css';
import {MainStore} from './mainstore.tsx';
import MainComp from './components/maincomp.tsx';

const mainstore = new MainStore();

function App() {
  return (
    <div className="App">
      <MainComp mainstore={mainstore} />
    </div>
  );
}

export default App;
