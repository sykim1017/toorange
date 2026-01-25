import React, { useState, useEffect, useRef, useCallback } from 'react';
import './styles.css';

// B5 용지 기준 고정 크기
const CANVAS_WIDTH = 516;
const CANVAS_HEIGHT = 728;
const LINE_HEIGHT = 56;
const TOTAL_LINES = 11;
const PADDING_X = 32;
const PADDING_TOP = 40;

// 폰트 사이즈 옵션
const FONT_SIZES = {
  small: 16,
  medium: 20,
  large: 26,
};

// AI 다듬기 시뮬레이션
const simulateAIPolish = async (text) => {
  await new Promise(resolve => setTimeout(resolve, 1500));
  return text + ' 진심으로 바랍니다.';
};

// AI 이어쓰기 시뮬레이션
const simulateAIContinue = async (context) => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  const isDifferent = context.includes('(다른 버전)');
  const lowerContext = context.toLowerCase();
  
  const variations = {
    건강: [
      '항상 건강 잘 챙기시고, 맛있는 것도 많이 드세요.',
      '몸 건강히 지내시고, 좋은 일만 가득하시길 바랍니다.',
      '건강이 제일 중요하니까, 무리하지 마시고 푹 쉬세요.',
    ],
    보고싶: [
      '곧 따뜻한 날이 오면 꼭 찾아뵙겠습니다.',
      '다음에 뵐 때까지 항상 건강하세요.',
      '빨리 만나고 싶어요. 그날이 어서 왔으면 좋겠습니다.',
    ],
    default: [
      '오늘 하루도 좋은 일만 가득하시길 바랍니다.',
      '항상 건강하시고 좋은 꿈 꾸세요.',
      '다음에 뵐 때까지 몸 건강히 계세요.',
      '멀리서나마 늘 응원하고 있습니다.',
    ],
  };
  
  let options;
  if (lowerContext.includes('건강') || lowerContext.includes('몸')) {
    options = variations.건강;
  } else if (lowerContext.includes('보고 싶') || lowerContext.includes('그리')) {
    options = variations.보고싶;
  } else {
    options = variations.default;
  }
  
  const idx = isDifferent ? Math.floor(Math.random() * options.length) : 0;
  return options[idx];
};

export default function App() {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const editorRef = useRef(null);
  const [scale, setScale] = useState(1);
  
  const [fontSizeKey, setFontSizeKey] = useState('medium');
  
  // AI 다듬기 상태
  const [selection, setSelection] = useState(null);
  const [showPolishButton, setShowPolishButton] = useState(false);
  const [buttonPosition, setButtonPosition] = useState({ top: 0, left: 0 });
  const [isPolishing, setIsPolishing] = useState(false);
  const [polishedResult, setPolishedResult] = useState(null);
  
  // AI 이어쓰기 상태
  const [showContinueButton, setShowContinueButton] = useState(false);
  const [continuePosition, setContinuePosition] = useState({ top: 200, left: 100 });
  const [isContinuing, setIsContinuing] = useState(false);
  const [generatedText, setGeneratedText] = useState('');
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [suggestionSpan, setSuggestionSpan] = useState(null);
  const continueTimerRef = useRef(null);

  const fontSize = FONT_SIZES[fontSizeKey];

  // 초기 텍스트
  useEffect(() => {
    if (editorRef.current && !editorRef.current.innerText.trim()) {
      editorRef.current.innerText = `아버지, 안녕하세요. 그동안 별일 없이 건강하게 잘 지내고 계셨나요?
계신 곳에서 식사는 제때 잘 챙겨 드시는지, 불편한 곳은
없으신지 늘 걱정되고 궁금한 마음뿐입니다.`;
    }
  }, []);

  // 화면 크기에 따라 scale 조정
  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const newScale = Math.min(1, (containerWidth - 32) / CANVAS_WIDTH);
        setScale(newScale);
      }
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  // 커서 위치 가져오기
  const getCaretPosition = (element) => {
    let caretOffset = 0;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(element);
      preCaretRange.setEnd(range.endContainer, range.endOffset);
      caretOffset = preCaretRange.toString().length;
    }
    return caretOffset;
  };

  // 텍스트 선택 감지
  const handleSelectionChange = useCallback(() => {
    const sel = window.getSelection();
    
    if (!sel || !editorRef.current?.contains(sel.anchorNode)) {
      if (!isPolishing && !polishedResult && !isContinuing && !showSuggestion) {
        setShowPolishButton(false);
        if (continueTimerRef.current) {
          clearTimeout(continueTimerRef.current);
          continueTimerRef.current = null;
        }
        setShowContinueButton(false);
        setSelection(null);
      }
      return;
    }

    const selectedText = sel.toString().trim();
    const editorText = editorRef.current?.innerText || '';
    
    // 텍스트 선택 - 다듬기 버튼
    if (selectedText.length > 5) {
      if (continueTimerRef.current) {
        clearTimeout(continueTimerRef.current);
        continueTimerRef.current = null;
      }
      setShowContinueButton(false);
      
      const range = sel.getRangeAt(0);
      const rects = range.getClientRects();
      const lastRect = rects[rects.length - 1];
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      
      if (canvasRect && lastRect) {
        let left = (lastRect.right - canvasRect.left) / scale;
        const top = (lastRect.bottom - canvasRect.top) / scale + 8;
        
        const minLeft = 140;
        const maxLeft = CANVAS_WIDTH - PADDING_X;
        left = Math.max(minLeft, Math.min(left, maxLeft));
        
        setButtonPosition({ top, left });
      }
      
      setSelection({ text: selectedText, range: range.cloneRange() });
      setShowPolishButton(true);
    } 
    // 커서만 - 마침표 뒤 이어쓰기
    else if (sel.isCollapsed && editorText.trim().length > 10 && !showSuggestion) {
      setShowPolishButton(false);
      setSelection(null);
      
      const range = sel.getRangeAt(0);
      const caretPos = getCaretPosition(editorRef.current);
      const textBeforeCursor = editorText.substring(0, caretPos);
      const trimmedText = textBeforeCursor.trimEnd();
      const endsWithPeriod = /[.!?。]$/.test(trimmedText);
      
      setShowContinueButton(false);
      if (continueTimerRef.current) {
        clearTimeout(continueTimerRef.current);
        continueTimerRef.current = null;
      }
      
      if (endsWithPeriod) {
        const rect = range.getBoundingClientRect();
        const canvasRect = canvasRef.current?.getBoundingClientRect();
        
        if (canvasRect) {
          let left = (rect.left - canvasRect.left) / scale;
          const top = (rect.bottom - canvasRect.top) / scale + 8;
          
          const minLeft = PADDING_X;
          const maxLeft = CANVAS_WIDTH - PADDING_X - 160;
          left = Math.max(minLeft, Math.min(left, maxLeft));
          
          setContinuePosition({ top, left });
          
          continueTimerRef.current = setTimeout(() => {
            setShowContinueButton(true);
          }, 800);
        }
      }
    } else {
      if (continueTimerRef.current) {
        clearTimeout(continueTimerRef.current);
        continueTimerRef.current = null;
      }
      setShowPolishButton(false);
      setShowContinueButton(false);
      setSelection(null);
    }
  }, [scale, isPolishing, polishedResult, isContinuing, showSuggestion]);

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      if (continueTimerRef.current) clearTimeout(continueTimerRef.current);
    };
  }, [handleSelectionChange]);

  // 다듬기 실행
  const handlePolish = async () => {
    if (!selection) return;
    setShowPolishButton(false);
    setIsPolishing(true);
    
    try {
      const polished = await simulateAIPolish(selection.text);
      setPolishedResult(polished);
      highlightSelection(polished);
      setIsPolishing(false);
    } catch (error) {
      setIsPolishing(false);
    }
  };

  const highlightSelection = (polishedText) => {
    if (!selection?.range) return;
    const range = selection.range;
    const span = document.createElement('span');
    span.className = 'ai-highlight';
    span.style.color = '#f97316';
    span.style.backgroundColor = '#fff7ed';
    span.dataset.original = selection.text;
    span.dataset.polished = polishedText;
    span.textContent = polishedText;
    range.deleteContents();
    range.insertNode(span);
  };

  const handleKeep = () => {
    const highlight = editorRef.current?.querySelector('.ai-highlight');
    if (highlight) {
      const original = highlight.dataset.original;
      highlight.replaceWith(document.createTextNode(original));
    }
    setPolishedResult(null);
    setSelection(null);
  };

  const handleApply = () => {
    const highlight = editorRef.current?.querySelector('.ai-highlight');
    if (highlight) {
      const polished = highlight.dataset.polished;
      highlight.replaceWith(document.createTextNode(polished));
    }
    setPolishedResult(null);
    setSelection(null);
  };

  // 버튼 위치 업데이트
  const updateButtonPosition = (element) => {
    if (!element || !canvasRef.current) return;
    
    const range = document.createRange();
    range.selectNodeContents(element);
    const rects = range.getClientRects();
    if (rects.length === 0) return;
    
    const lastRect = rects[rects.length - 1];
    const canvasRect = canvasRef.current.getBoundingClientRect();
    
    let left = (lastRect.left - canvasRect.left) / scale;
    let top = (lastRect.bottom - canvasRect.top) / scale + 8;
    
    const buttonWidth = 160;
    const minLeft = PADDING_X;
    const maxLeft = CANVAS_WIDTH - PADDING_X - buttonWidth;
    const maxTop = CANVAS_HEIGHT - 60;
    
    left = Math.max(minLeft, Math.min(left, maxLeft));
    top = Math.min(top, maxTop);
    
    setContinuePosition({ top, left });
  };

  // 이어쓰기 실행
  const handleContinue = async () => {
    setShowContinueButton(false);
    setIsContinuing(true);
    
    if (continueTimerRef.current) {
      clearTimeout(continueTimerRef.current);
      continueTimerRef.current = null;
    }
    
    try {
      const context = editorRef.current?.innerText || '';
      const continuation = await simulateAIContinue(context);
      
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const span = document.createElement('span');
        span.className = 'ai-suggestion';
        span.style.color = '#9ca3af';
        span.textContent = ' ' + continuation;
        range.insertNode(span);
        
        range.setStartAfter(span);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        
        setGeneratedText(continuation);
        setSuggestionSpan(span);
        
        requestAnimationFrame(() => {
          updateButtonPosition(span);
          setShowSuggestion(true);
          setIsContinuing(false);
        });
      } else {
        setIsContinuing(false);
      }
    } catch (error) {
      setIsContinuing(false);
    }
  };

  const handleDifferent = async () => {
    if (!suggestionSpan) return;
    setIsContinuing(true);
    
    try {
      const context = editorRef.current?.innerText?.replace(suggestionSpan.textContent, '') || '';
      const newContinuation = await simulateAIContinue(context + ' (다른 버전)');
      
      suggestionSpan.textContent = ' ' + newContinuation;
      setGeneratedText(newContinuation);
      
      requestAnimationFrame(() => {
        updateButtonPosition(suggestionSpan);
        setIsContinuing(false);
      });
    } catch (error) {
      setIsContinuing(false);
    }
  };

  const handleInsert = () => {
    if (!suggestionSpan) return;
    suggestionSpan.style.color = '#1a1a1a';
    suggestionSpan.className = '';
    setShowSuggestion(false);
    setSuggestionSpan(null);
    setGeneratedText('');
  };

  const handleEditorInput = () => {
    if (showSuggestion && suggestionSpan) {
      suggestionSpan.style.color = '#1a1a1a';
      suggestionSpan.className = '';
      setShowSuggestion(false);
      setSuggestionSpan(null);
    }
  };

  // 배경 줄 렌더링
  const renderLines = () => {
    const lines = [];
    for (let i = 0; i < TOTAL_LINES; i++) {
      lines.push(
        <div
          key={i}
          style={{
            position: 'absolute',
            top: PADDING_TOP + (i + 1) * LINE_HEIGHT,
            left: PADDING_X,
            right: PADDING_X,
            borderBottom: '1px solid rgba(0,0,0,0.1)',
          }}
        />
      );
    }
    return lines;
  };

  return (
    <div className="app-container">
      <div className="editor-wrapper">
        {/* 헤더 */}
        <div className="header">
          <h1>✏️ 편지 작성</h1>
        </div>

        {/* 폰트 선택 */}
        <div className="toolbar">
          {Object.keys(FONT_SIZES).map((key) => (
            <button
              key={key}
              onClick={() => setFontSizeKey(key)}
              className={`font-btn ${fontSizeKey === key ? 'active' : ''}`}
            >
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </button>
          ))}
        </div>

        {/* 편지지 */}
        <div ref={containerRef} className="canvas-container" style={{ height: CANVAS_HEIGHT * scale + 32 }}>
          <div
            ref={canvasRef}
            className="canvas"
            style={{
              width: CANVAS_WIDTH,
              height: CANVAS_HEIGHT,
              transform: `scale(${scale})`,
              transformOrigin: 'top center',
            }}
          >
            {renderLines()}
            
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={handleEditorInput}
              className="editor"
              style={{
                fontSize: fontSize,
                lineHeight: `${LINE_HEIGHT}px`,
                padding: `${PADDING_TOP}px ${PADDING_X}px`,
              }}
            />
            
            {/* 다듬기 버튼 */}
            {showPolishButton && !isPolishing && !polishedResult && (
              <div className="popup-btn" style={{ top: buttonPosition.top, left: buttonPosition.left, transform: 'translateX(-100%)' }}>
                <div className="arrow arrow-right" />
                <button onClick={handlePolish} className="btn-primary">이 문장 다듬기</button>
              </div>
            )}
            
            {/* 다듬기 로딩 */}
            {isPolishing && (
              <div className="popup-btn" style={{ top: buttonPosition.top, left: buttonPosition.left, transform: 'translateX(-100%)' }}>
                <div className="arrow arrow-right" />
                <div className="btn-loading">
                  <span className="spinner" />
                  다듬는 중...
                </div>
              </div>
            )}
            
            {/* 유지/반영 버튼 */}
            {polishedResult && !isPolishing && (
              <div className="popup-btn" style={{ top: buttonPosition.top, left: buttonPosition.left, transform: 'translateX(-100%)' }}>
                <div className="arrow arrow-right" />
                <div className="btn-group">
                  <button onClick={handleKeep} className="btn-secondary">유지</button>
                  <button onClick={handleApply} className="btn-secondary">반영</button>
                </div>
              </div>
            )}
            
            {/* 이어쓰기 버튼 */}
            {showContinueButton && !isPolishing && !polishedResult && !isContinuing && !showSuggestion && (
              <div className="popup-btn" style={{ top: continuePosition.top, left: continuePosition.left }}>
                <div className="arrow arrow-left" />
                <button onClick={handleContinue} className="btn-primary">이어서 써볼래요</button>
              </div>
            )}
            
            {/* 이어쓰기 로딩 */}
            {isContinuing && (
              <div className="popup-btn" style={{ top: continuePosition.top, left: continuePosition.left }}>
                <div className="arrow arrow-left" />
                <div className="btn-loading">
                  <span className="spinner" />
                  생성 중...
                </div>
              </div>
            )}
            
            {/* 다르게/넣기 버튼 */}
            {showSuggestion && !isContinuing && (
              <div className="popup-btn" style={{ top: continuePosition.top, left: continuePosition.left }}>
                <div className="arrow arrow-left" />
                <div className="btn-group">
                  <button onClick={handleDifferent} className="btn-secondary">다르게</button>
                  <button onClick={handleInsert} className="btn-secondary">넣기</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 안내 */}
        <div className="guide">
          💡 문장 드래그 → <span className="orange">다듬기</span> | 마침표 뒤 0.8초 대기 → <span className="gray">이어쓰기</span>
        </div>
      </div>
    </div>
  );
}
