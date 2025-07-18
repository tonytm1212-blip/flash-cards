import { useState, useEffect } from 'react'
import './App.css'
import * as pdfjsLib from 'pdfjs-dist/build/pdf'
import mammoth from 'mammoth'
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs'

// User data structure for localStorage
const USER_DATA_KEY = 'flashcard_user_data'
const USER_ACCOUNTS_KEY = 'flashcard_user_accounts'
const USAGE_STATS_KEY = 'flashcard_usage_stats'

// Default owner credentials
const OWNER_USERNAME = 'TY'
const OWNER_PASSWORD = '1'

// Helper functions for localStorage
const saveUserData = (username, data) => {
  const allUserData = JSON.parse(localStorage.getItem(USER_DATA_KEY) || '{}')
  allUserData[username] = data
  localStorage.setItem(USER_DATA_KEY, JSON.stringify(allUserData))
}

const loadUserData = (username) => {
  const allUserData = JSON.parse(localStorage.getItem(USER_DATA_KEY) || '{}')
  return allUserData[username] || {
    subjects: [],
    flashcards: [],
    knowItCards: [],
    studyItCards: []
  }
}

const saveUserAccount = (username, password) => {
  const accounts = JSON.parse(localStorage.getItem(USER_ACCOUNTS_KEY) || '{}')
  accounts[username] = password
  localStorage.setItem(USER_ACCOUNTS_KEY, JSON.stringify(accounts))
}

const getUserAccount = (username) => {
  const accounts = JSON.parse(localStorage.getItem(USER_ACCOUNTS_KEY) || '{}')
  return accounts[username]
}

const incrementUsageStats = () => {
  const stats = JSON.parse(localStorage.getItem(USAGE_STATS_KEY) || '{}')
  stats.totalLogins = (stats.totalLogins || 0) + 1
  stats.lastLogin = new Date().toISOString()
  localStorage.setItem(USAGE_STATS_KEY, JSON.stringify(stats))
}

const getUsageStats = () => {
  return JSON.parse(localStorage.getItem(USAGE_STATS_KEY) || '{}')
}

// Helper to detect mobile
const isMobile = () => /Mobi|Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent)

function App() {
  // Login state
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentUser, setCurrentUser] = useState('')
  const [loginError, setLoginError] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  // App state (will be user-specific)
  const [view, setView] = useState('Subjects')
  const [subjects, setSubjects] = useState([])
  const [newSubject, setNewSubject] = useState('')
  const [editingIndex, setEditingIndex] = useState(null)
  const [editingName, setEditingName] = useState('')

  // Flashcards: { subject: string, front: string, back: string, id: number }
  const [flashcards, setFlashcards] = useState([])
  const [createFront, setCreateFront] = useState('')
  const [createBack, setCreateBack] = useState('')
  const [createSubject, setCreateSubject] = useState('')
  const [createSuccess, setCreateSuccess] = useState(false)

  // Study view state
  const [studySubject, setStudySubject] = useState('')
  const [studyCards, setStudyCards] = useState([])
  const [studyIndex, setStudyIndex] = useState(0)
  const [showBack, setShowBack] = useState(false)
  const [studyResults, setStudyResults] = useState({}) // { cardId: 'known' | 'review' }
  const [flippedCards, setFlippedCards] = useState({}) // { cardId: boolean }
  const [currentAvailableCardIndex, setCurrentAvailableCardIndex] = useState(0)
  const [currentKnowItCardIndex, setCurrentKnowItCardIndex] = useState(0)
  const [currentStudyItCardIndex, setCurrentStudyItCardIndex] = useState(0)

  // How to Use modal state
  const [showHowTo, setShowHowTo] = useState(false)
  const [howToContent, setHowToContent] = useState('')

  // Know it, Study it state
  const [knowItCards, setKnowItCards] = useState([])
  const [studyItCards, setStudyItCards] = useState([])
  const [draggedCard, setDraggedCard] = useState(null)

  // Add state for editing card
  const [editingCardId, setEditingCardId] = useState(null)
  const [editingFront, setEditingFront] = useState('')
  const [editingBack, setEditingBack] = useState('')

  // Fix: Add the missing edit handler
  const handleStartEditCard = (card) => {
    setEditingCardId(card.id);
    setEditingFront(card.front);
    setEditingBack(card.back);
  };

  // Load user data when user changes
  useEffect(() => {
    if (isLoggedIn && currentUser) {
      const userData = loadUserData(currentUser)
      setSubjects(userData.subjects || [])
      setFlashcards(userData.flashcards || [])
      setKnowItCards(userData.knowItCards || [])
      setStudyItCards(userData.studyItCards || [])
    }
  }, [isLoggedIn, currentUser])

  // Save user data whenever it changes
  useEffect(() => {
    if (isLoggedIn && currentUser) {
      const userData = {
        subjects,
        flashcards,
        knowItCards,
        studyItCards
      }
      saveUserData(currentUser, userData)
    }
  }, [subjects, flashcards, knowItCards, studyItCards, isLoggedIn, currentUser])

  // Drag and drop handlers
  const handleDragStart = (e, card) => {
    setDraggedCard(card)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  // Navigate Know it cards
  const nextKnowItCard = () => {
    const knowItCardsForSubject = knowItCards.filter(card => card.subject === studySubject)
    if (currentKnowItCardIndex < knowItCardsForSubject.length - 1) {
      setCurrentKnowItCardIndex(currentKnowItCardIndex + 1)
    }
  }

  const prevKnowItCard = () => {
    if (currentKnowItCardIndex > 0) {
      setCurrentKnowItCardIndex(currentKnowItCardIndex - 1)
    }
  }

  // Navigate Study it cards
  const nextStudyItCard = () => {
    const studyItCardsForSubject = studyItCards.filter(card => card.subject === studySubject)
    if (currentStudyItCardIndex < studyItCardsForSubject.length - 1) {
      setCurrentStudyItCardIndex(currentStudyItCardIndex + 1)
    }
  }

  const prevStudyItCard = () => {
    if (currentStudyItCardIndex > 0) {
      setCurrentStudyItCardIndex(currentStudyItCardIndex - 1)
    }
  }

  // Handle drop with index updates
  const handleDrop = (e, targetCategory, cardOverride) => {
    e.preventDefault && e.preventDefault()
    const card = cardOverride || draggedCard
    if (!card) return

    console.log('Dropping card:', card.id, 'to category:', targetCategory)
    console.log('Card subject:', card.subject, 'Current study subject:', studySubject)

    // Only allow dropping if the card subject matches the current study subject
    if (card.subject !== studySubject) {
      console.log('Card subject does not match study subject, ignoring drop')
      setDraggedCard(null)
      return
    }

    // Use a more robust approach - update all arrays in a single operation
    if (targetCategory === 'knowIt') {
      setFlashcards(prev => prev.filter(c => c.id !== card.id))
      setKnowItCards(prev => {
        const newCards = [...prev, card]
        console.log('Added to knowItCards, new count:', newCards.length)
        setCurrentKnowItCardIndex(newCards.length - 1)
        return newCards
      })
      setStudyItCards(prev => prev.filter(c => c.id !== card.id))
    } else if (targetCategory === 'studyIt') {
      setFlashcards(prev => prev.filter(c => c.id !== card.id))
      setKnowItCards(prev => prev.filter(c => c.id !== card.id))
      setStudyItCards(prev => {
        const newCards = [...prev, card]
        console.log('Added to studyItCards, new count:', newCards.length)
        setCurrentStudyItCardIndex(newCards.length - 1)
        return newCards
      })
    }
    setDraggedCard(null)
  }

  // Add card to Know it/Study it from Create view
  const addToCategory = (card, category) => {
    if (category === 'knowIt') {
      setKnowItCards(prev => [...prev, card])
    } else if (category === 'studyIt') {
      setStudyItCards(prev => [...prev, card])
    }
  }

  // How to Use content for each view
  const howToTexts = {
    Subjects: `Create, rename, or delete subjects to organize your flashcards.`,
    Create: `Fill in the front and back of your flashcard, select a subject, and click Create. Your new card will appear in the list below.`,
    Import: `Import feature coming soon.`,
    Study: `Drag and drop flashcards between 'Know it' and 'Study it' categories. Use the buttons in Create view to quickly add cards. Review your cards in each category.`,
  }

  // Add subject
  const handleAddSubject = () => {
    const name = newSubject.trim()
    if (name && !subjects.includes(name)) {
      setSubjects([...subjects, name])
      setCreateSubject(name) // Auto-select the new subject for creating flashcards
      setNewSubject('')
    }
  }

  // Delete subject (now always allowed)
  const handleDeleteSubject = (idx) => {
    const subjectToDelete = subjects[idx]
    setSubjects(subjects.filter((_, i) => i !== idx))
    setFlashcards(flashcards.filter(f => f.subject !== subjectToDelete))
    setKnowItCards(prev => prev.filter(f => f.subject !== subjectToDelete))
    setStudyItCards(prev => prev.filter(f => f.subject !== subjectToDelete))
  }

  // Start renaming
  const handleStartEdit = (idx) => {
    setEditingIndex(idx)
    setEditingName(subjects[idx])
  }

  // Save rename
  const handleSaveEdit = (idx) => {
    const name = editingName.trim()
    if (name && !subjects.includes(name)) {
      // Update subject name in all card arrays
      const oldName = subjects[idx]
      setSubjects(subjects.map((s, i) => (i === idx ? name : s)))
      setFlashcards(flashcards.map(f => f.subject === oldName ? { ...f, subject: name } : f))
      setKnowItCards(prev => prev.map(f => f.subject === oldName ? { ...f, subject: name } : f))
      setStudyItCards(prev => prev.map(f => f.subject === oldName ? { ...f, subject: name } : f))
      setEditingIndex(null)
      setEditingName('')
    }
  }

  // Cancel rename
  const handleCancelEdit = () => {
    setEditingIndex(null)
    setEditingName('')
  }

  // Create flashcard
  const handleCreateFlashcard = (e) => {
    e.preventDefault()
    const front = createFront.trim()
    const back = createBack.trim()
    if (front && back && createSubject) {
      setFlashcards([
        ...flashcards,
        { subject: createSubject, front, back, id: Date.now() }
      ])
      setCreateFront('')
      setCreateBack('')
      setCreateSuccess(true)
      setTimeout(() => setCreateSuccess(false), 1200)
    }
  }

  // Delete individual flashcard
  const handleDeleteFlashcard = (id) => {
    setFlashcards(flashcards.filter(f => f.id !== id))
    setKnowItCards(prev => prev.filter(f => f.id !== id))
    setStudyItCards(prev => prev.filter(f => f.id !== id))
  }

  // Shuffle cards for study
  const shuffleCards = (cards) => {
    const arr = [...cards]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }

  // Start study session
  const startStudy = () => {
    const cards = flashcards.filter(f => f.subject === studySubject)
    setStudyCards(shuffleCards(cards))
    setStudyIndex(0)
    setShowBack(false)
    setStudyResults({})
  }

  // Mark card as known or needs review
  const markCard = (type) => {
    if (!studyCards[studyIndex]) return
    setStudyResults({ ...studyResults, [studyCards[studyIndex].id]: type })
    setShowBack(false)
    setStudyIndex(studyIndex + 1)
  }

  // Toggle card flip
  const toggleCardFlip = (cardId) => {
    setFlippedCards(prev => ({
      ...prev,
      [cardId]: !prev[cardId]
    }))
  }

  // Import state
  const [importing, setImporting] = useState(false)
  const [importSummary, setImportSummary] = useState([])
  const [importError, setImportError] = useState('')

  // Helper: extract Q&A or bullet points
  function extractFlashcardsFromText(text) {
    const cards = []
    // Q: ...\nA: ...
    const qaRegex = /Q[:：](.+?)\nA[:：](.+?)(?=\nQ[:：]|$)/gs
    let match
    while ((match = qaRegex.exec(text))) {
      cards.push({ front: match[1].trim(), back: match[2].trim() })
    }
    // If no Q&A, try bullet points (split by \n- or \n•)
    if (cards.length === 0) {
      const bullets = text.split(/\n[-•]\s+/).map(s => s.trim()).filter(Boolean)
      for (let i = 0; i < bullets.length - 1; i += 2) {
        cards.push({ front: bullets[i], back: bullets[i + 1] })
      }
    }
    return cards
  }

  // Handle file upload
  async function handleImportFile(e) {
    setImporting(true)
    setImportError('')
    setImportSummary([])
    const file = e.target.files[0]
    if (!file) return setImporting(false)
    let text = ''
    try {
      if (file.type === 'application/pdf') {
        // PDF: use pdfjs
        const arrayBuffer = await file.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
        let fullText = ''
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const content = await page.getTextContent()
          fullText += content.items.map(item => item.str).join(' ') + '\n'
        }
        text = fullText
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        // DOCX: use mammoth
        const arrayBuffer = await file.arrayBuffer()
        const result = await mammoth.extractRawText({ arrayBuffer })
        text = result.value
      } else {
        setImportError('Unsupported file type. Please upload a PDF or DOCX.')
        setImporting(false)
        return
      }
      const cards = extractFlashcardsFromText(text)
      if (cards.length === 0) {
        setImportError('No flashcards found in the file. Use Q/A or bullet formatting.')
        setImporting(false)
        return
      }
      // Add to flashcards state
      const newCards = cards.map(c => ({ ...c, subject: 'PDF Imports', id: Date.now() + Math.random() }))
      setFlashcards(flashcards => [...flashcards, ...newCards])
      setImportSummary(newCards)
    } catch (err) {
      setImportError('Failed to import: ' + err.message)
    }
    setImporting(false)
  }

  // Navigation
  const renderNav = () => (
    <nav className="app-nav">
      <button className="nav-btn" onClick={() => setView('Subjects')}>Subjects</button>
      <button className="nav-btn" onClick={() => setView('Create')}>Create</button>
      <button className="nav-btn" onClick={() => setView('Import')}>Import</button>
      <button className="nav-btn" onClick={() => setView('Study')}>Study</button>
    </nav>
  )

  // How to Use button
  const renderHowToBtn = (viewName) => (
    <button className="howto-btn" onClick={() => { setHowToContent(howToTexts[viewName]); setShowHowTo(true); }}>
      How to Use
    </button>
  )

  // How to Use modal
  const renderHowToModal = () => showHowTo && (
    <div className="howto-modal-bg" onClick={() => setShowHowTo(false)}>
      <div className="howto-modal" onClick={e => e.stopPropagation()}>
        <h3>How to Use</h3>
        <p>{howToContent}</p>
        <button className="nav-btn" onClick={() => setShowHowTo(false)}>Close</button>
      </div>
    </div>
  )

  // Subjects view
  const renderSubjects = () => (
    <div className="subjects-view">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Subjects</h2>
        {renderHowToBtn('Subjects')}
      </div>
      <ul className="subjects-list">
        {subjects.map((subject, idx) => (
          <li key={subject} className="subject-item">
            {editingIndex === idx ? (
              <>
                <input
                  value={editingName}
                  onChange={e => setEditingName(e.target.value)}
                  className="subject-input"
                  autoFocus
                />
                <button onClick={() => handleSaveEdit(idx)} className="small-btn">Save</button>
                <button onClick={handleCancelEdit} className="small-btn">Cancel</button>
              </>
            ) : (
              <>
                <span>{subject}</span>
                {subject !== 'PDF Imports' && (
                  <>
                    <button onClick={() => handleStartEdit(idx)} className="small-btn">Rename</button>
                    <button onClick={() => handleDeleteSubject(idx)} className="small-btn">Delete</button>
                  </>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      <div className="add-subject-row">
        <input
          value={newSubject}
          onChange={e => setNewSubject(e.target.value)}
          placeholder="New subject name"
          className="subject-input"
        />
        <button onClick={handleAddSubject} className="nav-btn">Add</button>
      </div>
    </div>
  )

  // Create view
  const renderCreate = () => (
    <div className="create-view">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Create Flashcard</h2>
        {renderHowToBtn('Create')}
      </div>
      <form className="create-form" onSubmit={handleCreateFlashcard}>
        <label>
          Front
          <textarea
            value={createFront}
            onChange={e => setCreateFront(e.target.value)}
            required
            className="card-input"
            rows={2}
            placeholder="Question, term, or prompt"
          />
        </label>
        <label>
          Back
          <textarea
            value={createBack}
            onChange={e => setCreateBack(e.target.value)}
            required
            className="card-input"
            rows={2}
            placeholder="Answer or explanation"
          />
        </label>
        <label>
          Subject
          <select
            value={createSubject}
            onChange={e => setCreateSubject(e.target.value)}
            className="card-input"
          >
            {subjects.map(subject => (
              <option key={subject} value={subject}>{subject}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="nav-btn">Create</button>
        {createSuccess && <span className="success-msg">Flashcard created!</span>}
      </form>
      <div className="created-list">
        <h3>Flashcards in {createSubject}</h3>
        <ul>
          {/* Show all cards for the selected subject from all arrays */}
          {[
            ...flashcards.filter(f => f.subject === createSubject).map(f => ({ ...f, location: 'Available' })),
            ...knowItCards.filter(f => f.subject === createSubject).map(f => ({ ...f, location: 'Know it' })),
            ...studyItCards.filter(f => f.subject === createSubject).map(f => ({ ...f, location: 'Study it' }))
          ].map(f => (
            <li key={f.id} className="created-card">
              {editingCardId === f.id ? (
                <>
                  <input
                    className="card-input"
                    value={editingFront}
                    onChange={e => setEditingFront(e.target.value)}
                    placeholder="Front"
                    style={{ marginBottom: '0.5em' }}
                  />
                  <input
                    className="card-input"
                    value={editingBack}
                    onChange={e => setEditingBack(e.target.value)}
                    placeholder="Back"
                    style={{ marginBottom: '0.5em' }}
                  />
                  <div className="card-actions">
                    <button className="small-btn" onClick={() => handleSaveEditCard(f, f.location)}>Save</button>
                    <button className="small-btn" onClick={handleCancelEditCard}>Cancel</button>
                  </div>
                </>
              ) : (
                <>
                  <span className="created-front">{f.front}</span>
                  <span className="created-back">{f.back}</span>
                  <div className="card-location">
                    <span className="location-badge">{f.location}</span>
                  </div>
                  <div className="card-actions">
                    {f.location === 'Available' && (
                      <>
                        <button className="small-btn" onClick={() => addToCategory(f, 'knowIt')}>Know it</button>
                        <button className="small-btn" onClick={() => addToCategory(f, 'studyIt')}>Study it</button>
                      </>
                    )}
                    <button className="small-btn" onClick={() => handleStartEditCard(f)}>Edit</button>
                    <button className="small-btn" onClick={() => handleDeleteFlashcard(f.id)}>Delete</button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )

  // Study view (now includes Know it, Study it)
  const renderStudy = () => {
    // Get available cards for current subject
    const availableCards = flashcards.filter(f => f.subject === studySubject)
    const currentAvailableCard = availableCards[currentAvailableCardIndex]

    // Get Know it and Study it cards for current subject only
    const knowItCardsForSubject = knowItCards.filter(card => card.subject === studySubject)
    const studyItCardsForSubject = studyItCards.filter(card => card.subject === studySubject)

    // Ensure indices are valid for current subject
    if (currentKnowItCardIndex >= knowItCardsForSubject.length && knowItCardsForSubject.length > 0) {
      setCurrentKnowItCardIndex(0)
    }
    if (currentStudyItCardIndex >= studyItCardsForSubject.length && studyItCardsForSubject.length > 0) {
      setCurrentStudyItCardIndex(0)
    }





    // Navigate available cards
    const nextAvailableCard = () => {
      if (currentAvailableCardIndex < availableCards.length - 1) {
        setCurrentAvailableCardIndex(currentAvailableCardIndex + 1)
      }
    }

    const prevAvailableCard = () => {
      if (currentAvailableCardIndex > 0) {
        setCurrentAvailableCardIndex(currentAvailableCardIndex - 1)
      }
    }

    // Reset available card index when subject changes
    const handleSubjectChange = (e) => {
      setStudySubject(e.target.value)
      setCurrentAvailableCardIndex(0)
      setCurrentKnowItCardIndex(0)
      setCurrentStudyItCardIndex(0)
    }

    return (
      <div className="study-view">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <h2>Study Flashcards</h2>
          {renderHowToBtn('Study')}
        </div>
        
        {/* Subject Selection */}
        <div className="subject-selection">
          <label>
            Subject
            <select
              value={studySubject}
              onChange={handleSubjectChange}
              className="card-input"
            >
              <option value="">Select a subject</option>
              {subjects.map(subject => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>
          </label>
        </div>

        {/* Available Cards from Selected Subject */}
        <div className="available-cards">
          <h3>Available Cards in {studySubject || 'No Subject'} ({availableCards.length})</h3>
          {availableCards.length > 0 && currentAvailableCard ? (
            <div className="single-card-container">
              <div 
                className={`available-card${flippedCards[currentAvailableCard.id] ? ' flipped' : ''}`}
                draggable={!isMobile()}
                onDragStart={isMobile() ? undefined : (e) => handleDragStart(e, currentAvailableCard)}
                onClick={() => toggleCardFlip(currentAvailableCard.id)}
              >
                <div className="card-inner">
                  <div className="card-front">
                    <span className="side-label">Front</span>
                    {currentAvailableCard.front}
                  </div>
                  <div className="card-back">
                    <span className="side-label">Back</span>
                    {currentAvailableCard.back}
                  </div>
                </div>
              </div>
              {isMobile() && (
                <div className="mobile-move-btns">
                  <button className="small-btn" onClick={e => { e.stopPropagation(); handleDrop({ preventDefault: () => {} }, 'knowIt', currentAvailableCard) }}>Move to Know it</button>
                  <button className="small-btn" onClick={e => { e.stopPropagation(); handleDrop({ preventDefault: () => {} }, 'studyIt', currentAvailableCard) }}>Move to Study it</button>
                </div>
              )}
              <div className="card-navigation">
                <button 
                  className="nav-btn" 
                  onClick={prevAvailableCard}
                  disabled={currentAvailableCardIndex === 0}
                >
                  Previous Card
                </button>
                <span className="card-counter">
                  {currentAvailableCardIndex + 1} of {availableCards.length}
                </span>
                <button 
                  className="nav-btn" 
                  onClick={nextAvailableCard}
                  disabled={currentAvailableCardIndex === availableCards.length - 1}
                >
                  Next Card
                </button>
              </div>
            </div>
          ) : (
            <div className="no-cards-message">
              {!studySubject ? 'Select a subject to see cards.' : 'No flashcards in this subject yet.'}
            </div>
          )}
        </div>

        {/* Know it, Study it Categories */}
        <div className="categories-container">
          <div 
            className="category-box knowit-box"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'knowIt')}
          >
            <h3>Know it - {studySubject || 'No Subject'} ({knowItCardsForSubject.length})</h3>
            {(() => {
              console.log('Know it debug:', {
                length: knowItCardsForSubject.length,
                currentIndex: currentKnowItCardIndex,
                hasCard: knowItCardsForSubject[currentKnowItCardIndex],
                cards: knowItCardsForSubject
              })
              return knowItCardsForSubject.length > 0 && knowItCardsForSubject[currentKnowItCardIndex]
            })() ? (
              <div className="single-card-container">
                <div 
                  className={`category-card${flippedCards[knowItCardsForSubject[currentKnowItCardIndex].id] ? ' flipped' : ''}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, knowItCardsForSubject[currentKnowItCardIndex])}
                  onClick={() => toggleCardFlip(knowItCardsForSubject[currentKnowItCardIndex].id)}
                >
                  <div className="card-inner">
                    <div className="card-front">
                      <span className="side-label">Front</span>
                      {knowItCardsForSubject[currentKnowItCardIndex].front}
                    </div>
                    <div className="card-back">
                      <span className="side-label">Back</span>
                      {knowItCardsForSubject[currentKnowItCardIndex].back}
                    </div>
                  </div>
                  <button className="small-btn" onClick={(e) => { 
                    e.stopPropagation(); 
                    const cardToRemove = knowItCardsForSubject[currentKnowItCardIndex]
                    // Move card back to available cards instead of deleting
                    setFlashcards(prev => [...prev, cardToRemove])
                    setKnowItCards(prev => {
                      const newCards = prev.filter(c => c.id !== cardToRemove.id)
                      // Adjust index if needed
                      if (currentKnowItCardIndex >= newCards.length) {
                        setCurrentKnowItCardIndex(Math.max(0, newCards.length - 1))
                      }
                      return newCards
                    })
                  }}>Move Back</button>
                </div>
                <div className="card-navigation">
                  <button 
                    className="nav-btn" 
                    onClick={prevKnowItCard}
                    disabled={currentKnowItCardIndex === 0}
                  >
                    Previous
                  </button>
                  <span className="card-counter">
                    {currentKnowItCardIndex + 1} of {knowItCardsForSubject.length}
                  </span>
                  <button 
                    className="nav-btn" 
                    onClick={nextKnowItCard}
                    disabled={currentKnowItCardIndex === knowItCardsForSubject.length - 1}
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : (
              <div className="no-cards-message">No cards yet</div>
            )}
          </div>
          <div 
            className="category-box studyit-box"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'studyIt')}
          >
            <h3>Study it - {studySubject || 'No Subject'} ({studyItCardsForSubject.length})</h3>
            {(() => {
              console.log('Study it debug:', {
                length: studyItCardsForSubject.length,
                currentIndex: currentStudyItCardIndex,
                hasCard: studyItCardsForSubject[currentStudyItCardIndex],
                cards: studyItCardsForSubject
              })
              return studyItCardsForSubject.length > 0 && studyItCardsForSubject[currentStudyItCardIndex]
            })() ? (
              <div className="single-card-container">
                <div 
                  className={`category-card${flippedCards[studyItCardsForSubject[currentStudyItCardIndex].id] ? ' flipped' : ''}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, studyItCardsForSubject[currentStudyItCardIndex])}
                  onClick={() => toggleCardFlip(studyItCardsForSubject[currentStudyItCardIndex].id)}
                >
                  <div className="card-inner">
                    <div className="card-front">
                      <span className="side-label">Front</span>
                      {studyItCardsForSubject[currentStudyItCardIndex].front}
                    </div>
                    <div className="card-back">
                      <span className="side-label">Back</span>
                      {studyItCardsForSubject[currentStudyItCardIndex].back}
                    </div>
                  </div>
                  <button className="small-btn" onClick={(e) => { 
                    e.stopPropagation(); 
                    const cardToRemove = studyItCardsForSubject[currentStudyItCardIndex]
                    // Move card back to available cards instead of deleting
                    setFlashcards(prev => [...prev, cardToRemove])
                    setStudyItCards(prev => {
                      const newCards = prev.filter(c => c.id !== cardToRemove.id)
                      // Adjust index if needed
                      if (currentStudyItCardIndex >= newCards.length) {
                        setCurrentStudyItCardIndex(Math.max(0, newCards.length - 1))
                      }
                      return newCards
                    })
                  }}>Move Back</button>
                </div>
                <div className="card-navigation">
                  <button 
                    className="nav-btn" 
                    onClick={prevStudyItCard}
                    disabled={currentStudyItCardIndex === 0}
                  >
                    Previous
                  </button>
                  <span className="card-counter">
                    {currentStudyItCardIndex + 1} of {studyItCardsForSubject.length}
                  </span>
                  <button 
                    className="nav-btn" 
                    onClick={nextStudyItCard}
                    disabled={currentStudyItCardIndex === studyItCardsForSubject.length - 1}
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : (
              <div className="no-cards-message">No cards yet</div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Placeholders for other views
  const renderImport = () => (
    <div className="import-view">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Import</h2>
        {renderHowToBtn('Import')}
      </div>
      <div className="main-placeholder">Import feature coming soon…</div>
    </div>
  )

  // Dark mode state
  const [darkMode, setDarkMode] = useState(false)

  // Toggle dark mode
  const toggleDarkMode = () => {
    setDarkMode(!darkMode)
  }

  // Render login screen
  const renderLogin = () => (
    <div className="login-view">
      <div className="login-container">
        <div className="login-header">
          <div className="mascot-placeholder" aria-label="Mascot">⚡️</div>
          <h1 className="app-title">Flash Study</h1>
        </div>
        <form onSubmit={handleLogin} className="login-form">
          <h2>Welcome to Flash Study</h2>
          <p className="login-subtitle">Sign in to access your flashcards</p>
          
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              className="login-input"
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="login-input"
              required
            />
          </div>
          
          {loginError && <div className="login-error">{loginError}</div>}
          
          <button type="submit" className="login-btn">
            Sign In
          </button>
          
          <div className="login-info">
            <p><strong>New users:</strong> Enter any username and password to create an account</p>
            <p><strong>Returning users:</strong> Use your username and the password you created</p>
          </div>
        </form>
      </div>
    </div>
  )

  // Render usage stats for owner
  const renderUsageStats = () => {
    if (currentUser !== OWNER_USERNAME) return null
    
    const stats = getUsageStats()
    return (
      <div className="usage-stats">
        <h3>App Usage Statistics</h3>
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-label">Total Logins:</span>
            <span className="stat-value">{stats.totalLogins || 0}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Last Login:</span>
            <span className="stat-value">
              {stats.lastLogin ? new Date(stats.lastLogin).toLocaleString() : 'Never'}
            </span>
          </div>
        </div>
      </div>
    )
  }

  // Handle login
  const handleLogin = (e) => {
    e.preventDefault()
    setLoginError('')

    if (!username.trim() || !password.trim()) {
      setLoginError('Please enter both username and password')
      return
    }

    // Check if it's the owner
    if (username === OWNER_USERNAME && password === OWNER_PASSWORD) {
      setIsLoggedIn(true)
      setCurrentUser(username)
      incrementUsageStats()
      setUsername('')
      setPassword('')
      return
    }

    // Check if user account exists
    const storedPassword = getUserAccount(username)
    
    if (storedPassword) {
      // User exists, check password
      if (password === storedPassword) {
        setIsLoggedIn(true)
        setCurrentUser(username)
        incrementUsageStats()
        setUsername('')
        setPassword('')
        return
      } else {
        setLoginError('Incorrect password')
        return
      }
    } else {
      // New user, create account with the password they entered
      saveUserAccount(username, password)
      setIsLoggedIn(true)
      setCurrentUser(username)
      incrementUsageStats()
      setUsername('')
      setPassword('')
      return
    }
  }

  // Handle logout
  const handleLogout = () => {
    // Save current user data before clearing state
    if (currentUser) {
      const userData = {
        subjects,
        flashcards,
        knowItCards,
        studyItCards
      }
      saveUserData(currentUser, userData)
    }
    
    // Clear all state
    setIsLoggedIn(false)
    setCurrentUser('')
    setView('Subjects')
    setSubjects([])
    setFlashcards([])
    setKnowItCards([])
    setStudyItCards([])
    setStudySubject('')
    setCreateSubject('')
    setCreateFront('')
    setCreateBack('')
    setFlippedCards({})
    setCurrentAvailableCardIndex(0)
    setCurrentKnowItCardIndex(0)
    setCurrentStudyItCardIndex(0)
  }

  // If not logged in, show login screen
  if (!isLoggedIn) {
    return (
      <div className={`app-container ${darkMode ? 'dark-mode' : ''}`}>
        <header className="app-header">
          <button className="dark-mode-toggle" onClick={toggleDarkMode} aria-label="Toggle dark mode">
            {darkMode ? '☀️' : '🌙'}
          </button>
        </header>
        {renderLogin()}
      </div>
    )
  }

  return (
    <div className={`app-container ${darkMode ? 'dark-mode' : ''}`}>
      <header className="app-header">
        <div className="mascot-placeholder" aria-label="Mascot">⚡️</div>
        <h1 className="app-title">Flash Study</h1>
        <div className="user-info">
          <span className="username">Welcome, {currentUser}!</span>
          <button className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
        <button className="dark-mode-toggle" onClick={toggleDarkMode} aria-label="Toggle dark mode">
          {darkMode ? '☀️' : '🌙'}
        </button>
      </header>
      {renderNav()}
      <main className="app-main">
        {renderHowToModal()}
        {renderUsageStats()}
        {view === 'Subjects' && renderSubjects()}
        {view === 'Create' && renderCreate()}
        {view === 'Import' && renderImport()}
        {view === 'Study' && renderStudy()}
      </main>
    </div>
  )
}

export default App
