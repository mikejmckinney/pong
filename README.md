# Pong - Retro Arcade Game

A web-based Pong game optimized for mobile devices with a retro arcade aesthetic featuring synthwave colors and classic gameplay.

## Features

### Game Modes
- **Single Player**: Play against an AI opponent with adjustable difficulty
- **Local Multiplayer**: Two players on the same device
- **Online Multiplayer**: Play with friends online (requires WebSocket server)

### Special Modes
- **Classic Mode**: Traditional Pong gameplay
- **Speed Mode**: Faster ball speeds for intense action
- **Power-up Mode**: Collect power-ups during gameplay
- **Reverse Controls**: Challenge yourself with inverted controls

### Power-ups
- **Speed Boost** ⚡: Increases ball speed
- **Paddle Grow** ↕: Makes paddles larger
- **Slow Motion** ⏱: Slows down the ball

### Controls

#### Desktop
- **Player 1**: W (up) / S (down)
- **Player 2**: Arrow Up / Arrow Down (local multiplayer only)
- **Pause**: ESC or Pause button

#### Mobile
- Touch controls on the left and right sides of the screen
- Drag to move paddles up and down

## Technical Details

### Built With
- Pure HTML5, CSS3, and JavaScript (no frameworks)
- Canvas API for game rendering
- Web Audio API for retro sound effects
- LocalStorage for settings and leaderboard persistence

### Features
- Responsive design for all screen sizes
- Touch-friendly mobile interface
- Synthwave color palette with neon effects
- Retro sound effects (paddle hits, wall bounces, scoring)
- Adjustable AI difficulty (Easy, Medium, Hard)
- Local leaderboard system
- Settings persistence

## Getting Started

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/mikejmckinney/pong.git
   cd pong
   ```

2. Open `index.html` in a web browser, or serve it with a local server:
   ```bash
   python3 -m http.server 8080
   # Then open http://localhost:8080 in your browser
   ```

### Playing the Game
1. Select a game mode (Single Player, Local Multiplayer, or Online)
2. Choose a special mode (Classic, Speed, Power-up, or Reverse)
3. Use keyboard or touch controls to move your paddle
4. First to 7 points wins!

## Customization

### Game Constants
Edit the `GAME_CONSTANTS` object in `game.js` to adjust:
- Power-up spawn rate and lifetime
- Touch sensitivity
- Online connection delays

### Colors
Modify CSS custom properties in `styles.css`:
```css
:root {
    --neon-pink: #ff006e;
    --neon-blue: #00f5ff;
    --neon-purple: #8b00ff;
    --neon-orange: #ff9500;
    --dark-bg: #0a0015;
    --darker-bg: #050008;
}
```

## Online Multiplayer Setup

The game includes a placeholder for online multiplayer. To implement:

1. Set up a WebSocket server (e.g., using Socket.io)
2. Update the `createRoom()` and `joinRoom()` functions in `game.js`
3. Implement game state synchronization between clients

## Browser Support

- Chrome/Edge (recommended)
- Firefox
- Safari (iOS/macOS)
- Mobile browsers with touch support

## License

MIT License - feel free to use and modify!

## Credits

Created as a modern take on the classic Pong game with mobile-first design and retro aesthetics.
