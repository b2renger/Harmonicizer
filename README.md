
TODO
- improve harmonic knowledge base
- fix not edittin mobile (need a long press to activate a note, maybe there is debounce time that could be shorten)

- add a performance section to improvize melodies


--

I want to buil a web app called Harmonicizer. 

The goal is to create and compose musical chord progression and to explore it.

The app should have to modes :

# The composer
This mode should you help you build chord progressions. You would have a grid of cards on which you can click. When first click on a card you should be able to select a chord from a dictionary of musical chords and its duration either 1,2,3,4 or a silence. When the chord progression has at least one chord, the chod list you can choos from should be colorized and hierarchised to show the chords that have most consonance first and in hotter colors and the ones with least chords in common at the end of the list in colder colors.
On the chord progression interface the user should be able to select the tempo, should be able to select a synthetizer and should be able to make the chord progression play in a loop.

# The explorer
This mode is a self organizing map, chords are nodes, notes are nodes (smaller) and notes should be attach to their chords if a not is in two chords it should be attach to both cords and not show as a duplicate. Nodes are masses and links are springs. The user should be able to adjust simulation parameters. And when he clicks on a node the chord or the note should play.

# Features
The user should be able to export and import chord progressions and sessions (synth selection, loop etc) as human readable json
The app should adapt to different layouts and adapt to landscape and portrait modes.
The app should be installed as a pwa.

# Tech stack
- react 
- react three fiber (explorer)
- Tone.js

Help me write a design and code roadmap to feed to an LLM as context to build this app idea