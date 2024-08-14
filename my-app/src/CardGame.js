import React, { useState, useEffect, useCallback } from 'react';
import './CardGame.css'; // Import your CSS

const cardData = [
    // Your card data here
    { value: 14, img: './cards/ace_of_spades.svg' },
    { value: 2, img: './cards/2_of_spades.svg' },
    { value: 3, img: './cards/3_of_spades.svg' },
    { value: 4, img: './cards/4_of_spades.svg' },
    { value: 5, img: './cards/5_of_spades.svg' },
    { value: 6, img: './cards/6_of_spades.svg' },
    { value: 7, img: './cards/7_of_spades.svg' },
    { value: 8, img: './cards/8_of_spades.svg' },
    { value: 9, img: './cards/9_of_spades.svg' },
    { value: 10, img: './cards/10_of_spades.svg' },
    { value: 11, img: './cards/jack_of_spades2.svg' },
    { value: 12, img: './cards/queen_of_spades2.svg' },
    { value: 13, img: './cards/king_of_spades2.svg' },
    { value: 14, img: './cards/ace_of_clubs.svg' },
    { value: 2, img: './cards/2_of_clubs.svg' },
    { value: 3, img: './cards/3_of_clubs.svg' },
    { value: 4, img: './cards/4_of_clubs.svg' },
    { value: 5, img: './cards/5_of_clubs.svg' },
    { value: 6, img: './cards/6_of_clubs.svg' },
    { value: 7, img: './cards/7_of_clubs.svg' },
    { value: 8, img: './cards/8_of_clubs.svg' },
    { value: 9, img: './cards/9_of_clubs.svg' },
    { value: 10, img: './cards/10_of_clubs.svg' },
    { value: 11, img: './cards/jack_of_clubs2.svg' },
    { value: 12, img: './cards/queen_of_clubs2.svg' },
    { value: 13, img: './cards/king_of_clubs2.svg' },
    { value: 14, img: './cards/ace_of_hearts.svg' },
    { value: 2, img: './cards/2_of_hearts.svg' },
    { value: 3, img: './cards/3_of_hearts.svg' },
    { value: 4, img: './cards/4_of_hearts.svg' },
    { value: 5, img: './cards/5_of_hearts.svg' },
    { value: 6, img: './cards/6_of_hearts.svg' },
    { value: 7, img: './cards/7_of_hearts.svg' },
    { value: 8, img: './cards/8_of_hearts.svg' },
    { value: 9, img: './cards/9_of_hearts.svg' },
    { value: 10, img: './cards/10_of_hearts.svg' },
    { value: 11, img: './cards/jack_of_hearts2.svg' },
    { value: 12, img: './cards/queen_of_hearts2.svg' },
    { value: 13, img: './cards/king_of_hearts2.svg' },
    { value: 14, img: './cards/ace_of_diamonds.svg' },
    { value: 2, img: './cards/2_of_diamonds.svg' },
    { value: 3, img: './cards/3_of_diamonds.svg' },
    { value: 4, img: './cards/4_of_diamonds.svg' },
    { value: 5, img: './cards/5_of_diamonds.svg' },
    { value: 6, img: './cards/6_of_diamonds.svg' },
    { value: 7, img: './cards/7_of_diamonds.svg' },
    { value: 8, img: './cards/8_of_diamonds.svg' },
    { value: 9, img: './cards/9_of_diamonds.svg' },
    { value: 10, img: './cards/10_of_diamonds.svg' },
    { value: 11, img: './cards/jack_of_diamonds2.svg' },
    { value: 12, img: './cards/queen_of_diamonds2.svg' },
    { value: 13, img: './cards/king_of_diamonds2.svg' },
  ];

  
  const CardGame = () => {
    const [deck, setDeck] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isGameOver, setIsGameOver] = useState(false);
    const [gameCards, setGameCards] = useState([null, null, null, null, null]);
    const [flippedCards, setFlippedCards] = useState([false, false, false, false, false]);
    const [errorMessage, setErrorMessage] = useState('');
  
    const startGame = useCallback(() => {
      let shuffledDeck = shuffleDeck([...cardData]);
      let initialCards = shuffledDeck.slice(0, 5);
      setDeck(shuffledDeck);
      setGameCards(initialCards);
      setFlippedCards([true, false, false, false, true]); // First and fifth card start visible, middle three are hidden
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
      // Exclude the current card and any already used cards
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
    
        setFlippedCards((prevFlipped) => {
          let newFlipped = [...prevFlipped];
          newFlipped[currentIndex] = true; // Mark this card as played on, removing hidden.jpeg
          return newFlipped;
        });
    
        if (correct) {
          if (currentIndex < 4) {
            setGameCards(updatedCards);
            setCurrentIndex(currentIndex + 1);
          } else {
            setIsGameOver(true);
          }
        } else {
          // Set the error message based on the current index
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
          setErrorMessage(message); // Update the error message
          setGameCards(updatedCards);
          setCurrentIndex(0);
        }
      }
    };
    
  
    const handleRestart = () => {
      startGame();
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
              className={`card ${flippedCards[index] ? 'visible' : 'hidden'} ${index === currentIndex ? 'current-card' : ''}`}  // <--- Change 1: Added 'current-card' class conditionally
            >
              <div className="arrow-indicator"></div>  
              <img src={flippedCards[index] ? (card ? card.img : './hidden.jpeg') : './hidden.jpeg'} alt="card" />
            </div>
          ))}
        </div>
        <div className="controls">
          <button onClick={() => handleGuess('higher')}>Higher</button>
          <button onClick={() => handleGuess('lower')}>Lower</button>
          <button onClick={() => handleGuess('even')}>Even</button>
          <button onClick={handleRestart}>Restart</button>
        </div>
        {isGameOver && (
          <div className="game-over">
            <p>Congratulations! You guessed the last card correctly!</p>
          </div>
        )}

        {errorMessage && (
      <div className="error-message">
        <button className="close-button" onClick={handleCloseError}>×</button>
        <p>{errorMessage}</p>
      </div>
    )}
      </div>
    );
    
  };
  
  export default CardGame;
  