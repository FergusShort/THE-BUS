import React, { useState, useEffect, useCallback } from 'react';
import './CardGame.css'; // Import your CSS

const cardData = [
  { value: 14, img: `${process.env.PUBLIC_URL}/cards/ace_of_spades.svg` },
  { value: 2, img: `${process.env.PUBLIC_URL}/cards/2_of_spades.svg` },
  { value: 3, img: `${process.env.PUBLIC_URL}/cards/3_of_spades.svg` },
  { value: 4, img: `${process.env.PUBLIC_URL}/cards/4_of_spades.svg` },
  { value: 5, img: `${process.env.PUBLIC_URL}/cards/5_of_spades.svg` },
  { value: 6, img: `${process.env.PUBLIC_URL}/cards/6_of_spades.svg` },
  { value: 7, img: `${process.env.PUBLIC_URL}/cards/7_of_spades.svg` },
  { value: 8, img: `${process.env.PUBLIC_URL}/cards/8_of_spades.svg` },
  { value: 9, img: `${process.env.PUBLIC_URL}/cards/9_of_spades.svg` },
  { value: 10, img: `${process.env.PUBLIC_URL}/cards/10_of_spades.svg` },
  { value: 11, img: `${process.env.PUBLIC_URL}/cards/jack_of_spades2.svg` },
  { value: 12, img: `${process.env.PUBLIC_URL}/cards/queen_of_spades2.svg` },
  { value: 13, img: `${process.env.PUBLIC_URL}/cards/king_of_spades2.svg` },
  { value: 14, img: `${process.env.PUBLIC_URL}/cards/ace_of_clubs.svg` },
  { value: 2, img: `${process.env.PUBLIC_URL}/cards/2_of_clubs.svg` },
  { value: 3, img: `${process.env.PUBLIC_URL}/cards/3_of_clubs.svg` },
  { value: 4, img: `${process.env.PUBLIC_URL}/cards/4_of_clubs.svg` },
  { value: 5, img: `${process.env.PUBLIC_URL}/cards/5_of_clubs.svg` },
  { value: 6, img: `${process.env.PUBLIC_URL}/cards/6_of_clubs.svg` },
  { value: 7, img: `${process.env.PUBLIC_URL}/cards/7_of_clubs.svg` },
  { value: 8, img: `${process.env.PUBLIC_URL}/cards/8_of_clubs.svg` },
  { value: 9, img: `${process.env.PUBLIC_URL}/cards/9_of_clubs.svg` },
  { value: 10, img: `${process.env.PUBLIC_URL}/cards/10_of_clubs.svg` },
  { value: 11, img: `${process.env.PUBLIC_URL}/cards/jack_of_clubs2.svg` },
  { value: 12, img: `${process.env.PUBLIC_URL}/cards/queen_of_clubs2.svg` },
  { value: 13, img: `${process.env.PUBLIC_URL}/cards/king_of_clubs2.svg` },
  { value: 14, img: `${process.env.PUBLIC_URL}/cards/ace_of_hearts.svg` },
  { value: 2, img: `${process.env.PUBLIC_URL}/cards/2_of_hearts.svg` },
  { value: 3, img: `${process.env.PUBLIC_URL}/cards/3_of_hearts.svg` },
  { value: 4, img: `${process.env.PUBLIC_URL}/cards/4_of_hearts.svg` },
  { value: 5, img: `${process.env.PUBLIC_URL}/cards/5_of_hearts.svg` },
  { value: 6, img: `${process.env.PUBLIC_URL}/cards/6_of_hearts.svg` },
  { value: 7, img: `${process.env.PUBLIC_URL}/cards/7_of_hearts.svg` },
  { value: 8, img: `${process.env.PUBLIC_URL}/cards/8_of_hearts.svg` },
  { value: 9, img: `${process.env.PUBLIC_URL}/cards/9_of_hearts.svg` },
  { value: 10, img: `${process.env.PUBLIC_URL}/cards/10_of_hearts.svg` },
  { value: 11, img: `${process.env.PUBLIC_URL}/cards/jack_of_hearts2.svg` },
  { value: 12, img: `${process.env.PUBLIC_URL}/cards/queen_of_hearts2.svg` },
  { value: 13, img: `${process.env.PUBLIC_URL}/cards/king_of_hearts2.svg` },
  { value: 14, img: `${process.env.PUBLIC_URL}/cards/ace_of_diamonds.svg` },
  { value: 2, img: `${process.env.PUBLIC_URL}/cards/2_of_diamonds.svg` },
  { value: 3, img: `${process.env.PUBLIC_URL}/cards/3_of_diamonds.svg` },
  { value: 4, img: `${process.env.PUBLIC_URL}/cards/4_of_diamonds.svg` },
  { value: 5, img: `${process.env.PUBLIC_URL}/cards/5_of_diamonds.svg` },
  { value: 6, img: `${process.env.PUBLIC_URL}/cards/6_of_diamonds.svg` },
  { value: 7, img: `${process.env.PUBLIC_URL}/cards/7_of_diamonds.svg` },
  { value: 8, img: `${process.env.PUBLIC_URL}/cards/8_of_diamonds.svg` },
  { value: 9, img: `${process.env.PUBLIC_URL}/cards/9_of_diamonds.svg` },
  { value: 10, img: `${process.env.PUBLIC_URL}/cards/10_of_diamonds.svg` },
  { value: 11, img: `${process.env.PUBLIC_URL}/cards/jack_of_diamonds2.svg` },
  { value: 12, img: `${process.env.PUBLIC_URL}/cards/queen_of_diamonds2.svg` },
  { value: 13, img: `${process.env.PUBLIC_URL}/cards/king_of_diamonds2.svg` },
];



const CardGame = () => {
  const [deck, setDeck] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [gameCards, setGameCards] = useState([null, null, null, null, null]);
  const [flippedCards, setFlippedCards] = useState([false, false, false, false, false]);
  const [previousCards, setPreviousCards] = useState([null, null, null, null, null]); // Track previous cards
  const [errorMessage, setErrorMessage] = useState('');

  const startGame = useCallback(() => {
    let shuffledDeck = shuffleDeck([...cardData]);
    let initialCards = shuffledDeck.slice(0, 5);
    setDeck(shuffledDeck);
    setGameCards(initialCards);
    setFlippedCards([true, false, false, false, true]); // First and fifth card visible, middle three hidden
    setPreviousCards([null, null, null, null, null]); // Initialize previous cards as empty
    setCurrentIndex(0);
    setIsGameOver(false);
  }, []);

  useEffect(() => {
    startGame();
  }, [startGame]);

  const shuffleDeck = (deck) => {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  };

  const getRandomCard = (deck, currentCard, usedCards) => {
    let availableCards = deck.filter(card => card !== currentCard && !usedCards.includes(card));
    return availableCards[Math.floor(Math.random() * availableCards.length)];
  };

  const handleGuess = (type) => {
  if (isGameOver) return;

  let currentCard = gameCards[currentIndex];
  let usedCards = gameCards.slice(); // Copy the current game cards to use in getRandomCard
  let nextCard = getRandomCard(deck, currentCard, usedCards);

  if (currentCard && nextCard) {
    let currentCardValue = currentCard.value;
    let nextCardValue = nextCard.value;

    let correct = false;
    if (type === 'higher' && nextCardValue > currentCardValue) {
      correct = true;
    } else if (type === 'lower' && nextCardValue < currentCardValue) {
      correct = true;
    } else if (type === 'even' && nextCardValue === currentCardValue) {
      correct = true;
    }

    let updatedCards = [...gameCards];
    updatedCards[currentIndex] = nextCard;

    // Update the previousCards array with the current card
    let updatedPreviousCards = [...previousCards];
    updatedPreviousCards[currentIndex] = currentCard;

    // Mark the current card as flipped
    setFlippedCards((prevFlipped) => {
      let newFlipped = [...prevFlipped];
      newFlipped[currentIndex] = true; // Ensure the current card is flipped and visible
      return newFlipped;
    });

    if (correct) {
      setErrorMessage(''); // Clear error message on correct guess
      if (currentIndex < 4) {
        setGameCards(updatedCards);
        setPreviousCards(updatedPreviousCards); // Persist previous cards
        setCurrentIndex(currentIndex + 1); // Move to the next card
      } else {
        setGameCards(updatedCards);
        setPreviousCards(updatedPreviousCards); // Persist previous cards
        setIsGameOver(true);
      }
    } else {
      // Incorrect guess logic: reset to index 0 but preserve previous cards
      let message = '';
      switch (currentIndex) {
        case 0:
          message = '1 Sip';
          break;
        case 1:
          message = '2 Sips';
          break;
        case 2:
          message = '3 Sips';
          break;
        case 3:
          message = 'Half Beverage';
          break;
        case 4:
          message = 'Full Beverage';
          break;
        default:
          break;
      }
      setErrorMessage(message);

      // Persist the game state and reset to the first card
      setGameCards(updatedCards);
      setPreviousCards(updatedPreviousCards); // Update previous cards
      setCurrentIndex(0); // Reset to the starting index
    }
  }
};


  const handleRestart = () => {
    startGame();
    setErrorMessage(''); // Clear any previous error message on restart
  };

  const handleCloseError = () => {
    setErrorMessage(''); // Close the error message
  };

  return (
    <div className="card-game">
      <div className="card-container">
        {gameCards.map((card, index) => (
          <div
            key={index}
            className={`card ${flippedCards[index] ? 'visible' : 'hidden'} ${index === currentIndex ? 'current-card' : ''}`}
          >
            {/* Show the previous card for the currentIndex unless it's replaced */}
            {previousCards[index] && (
              <div
                className={`card previous ${flippedCards[index] && index !== currentIndex ? 'previous-card-visible' : 'hidden-card'
                  }`}
              >
                <img src={previousCards[index]?.img} alt="previous card" />
              </div>
            )}
            {/* Show the current card if it's flipped or if it's the current index */}
            {flippedCards[index] || index === currentIndex ? (
              <img src={card ? card.img : './hidden.jpeg'} alt="card" />
            ) : (
              <img src="./hidden.jpeg" alt="hidden card" />
            )}
            <div className="arrow-indicator"></div>
            <img src={flippedCards[index] ? (card ? card.img : './hidden.jpeg') : './hidden.jpeg'} alt="card" />
          </div>
        ))}
      </div>

      <div className="controls">
        <button onClick={() => handleGuess('higher')}>Higher</button>
        <button onClick={() => handleGuess('lower')}>Lower</button>
        <button onClick={() => handleGuess('even')}>Even</button>
        <button onClick={() => handleRestart()}>Restart</button>
      </div>

      {errorMessage && (
        <div className="error-message">
          <button className="close-button" onClick={handleCloseError}>×</button>
          <p>{errorMessage}</p>
        </div>
      )}

      {isGameOver && (
        <div className="game-over">
          <h2>WINNER</h2>
        </div>
      )}
    </div>
  );
};

export default CardGame;
