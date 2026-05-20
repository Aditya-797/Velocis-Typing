// Velocis Typing - Main Application
class TypingApp {
  constructor(){
    this.currentPage='home';this.testDuration=30;this.difficulty='easy';
    this.testMode='time';this.testWords=25;
    this.timer=null;this.timeLeft=30;this.testStarted=false;this.testText='';
    this.typedChars=[];this.currentIndex=0;this.errors=0;this.startTime=null;
    this.stats=this.loadData('tm_stats',{tests:[],lessonsCompleted:[],totalChars:0,totalTime:0,missedKeys:{}});
    if(!this.stats.missedKeys) this.stats.missedKeys = {};
    this.settings=this.loadData('tm_settings',{theme:'dark',showKeyboard:true,fontSize:22,sound:false,errorSound:true,smoothCaret:true,liveWpm:true,fontFamily:"'Inter', sans-serif",soundProfile:"mech_red",caretStyle:'line'});
    if(this.settings.theme !== 'dark' && this.settings.theme !== 'light') this.settings.theme = 'dark';
    this.testHeatmapActive = false;
    this.activeMode=null;this.activeLessonId=null;
    this.init();
  }
  loadData(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}}
  saveData(k,v){localStorage.setItem(k,JSON.stringify(v));}
  init(){
    document.documentElement.setAttribute('data-theme',this.settings.theme);
    this.applySettings();this.bindNav();this.bindTest();this.bindLessons();
    this.bindPractice();this.bindSettings();this.bindModal();this.bindGames();
    this.renderHome();this.renderLessons();this.buildKeyboard('virtual-keyboard');
    this.initTypewriter();
  }
  initTypewriter(){
    const phrases=['Elite Speed','Pro Analytics','Peak Performance','Typing Mastery'];
    let pIdx=0, cIdx=0, isDeleting=false;
    const el=document.getElementById('hero-typewriter');
    if(!el)return;
    const type=()=>{
      const currentPhrase=phrases[pIdx];
      if(isDeleting) {
        el.textContent=currentPhrase.substring(0,cIdx-1);
        cIdx--;
      } else {
        el.textContent=currentPhrase.substring(0,cIdx+1);
        cIdx++;
      }
      let speed=isDeleting?50:100;
      if(!isDeleting&&cIdx===currentPhrase.length){ speed=2000; isDeleting=true; }
      else if(isDeleting&&cIdx===0){ isDeleting=false; pIdx=(pIdx+1)%phrases.length; speed=500; }
      setTimeout(type,speed);
    };
    setTimeout(type,1000);
  }
  applySettings(){
    document.documentElement.style.setProperty('--typing-font-size',this.settings.fontSize+'px');
    document.documentElement.style.setProperty('--font-mono',this.settings.fontFamily);
    if(document.getElementById('setting-theme-select')) document.getElementById('setting-theme-select').value=this.settings.theme;
    document.getElementById('setting-keyboard').checked=this.settings.showKeyboard;
    document.getElementById('setting-font-size').value=this.settings.fontSize;
    if(document.getElementById('setting-font-family')) document.getElementById('setting-font-family').value=this.settings.fontFamily;
    if(document.getElementById('setting-sound-profile')) document.getElementById('setting-sound-profile').value=this.settings.soundProfile;
    document.getElementById('setting-sound').checked=this.settings.sound;
    document.getElementById('setting-error-sound').checked=this.settings.errorSound;
    document.getElementById('setting-smooth-caret').checked=this.settings.smoothCaret;
    if(document.getElementById('setting-live-wpm')) document.getElementById('setting-live-wpm').checked=this.settings.liveWpm;
    if(document.getElementById('setting-caret-style')) document.getElementById('setting-caret-style').value=this.settings.caretStyle;
    document.documentElement.setAttribute('data-caret', this.settings.caretStyle);
    document.querySelectorAll('.keyboard-container').forEach(el=>{el.style.display=this.settings.showKeyboard?'':'none';});
  }

  bindNav(){
    document.querySelectorAll('.nav-link').forEach(btn=>{
      btn.addEventListener('click',()=>this.navigate(btn.dataset.page));
    });
    document.getElementById('theme-toggle').addEventListener('click',()=>{
      const themes = ['dark', 'light'];
      let idx = themes.indexOf(this.settings.theme);
      this.settings.theme = themes[(idx + 1) % themes.length];
      document.documentElement.setAttribute('data-theme',this.settings.theme);
      if(document.getElementById('setting-theme-select')) document.getElementById('setting-theme-select').value=this.settings.theme;
      this.saveData('tm_settings',this.settings);
    });
    document.getElementById('hero-start-test').addEventListener('click',()=>this.navigate('test'));
    document.getElementById('hero-start-lesson').addEventListener('click',()=>this.navigate('lessons'));
  }
  navigate(page){
    this.stopTest();this.stopGame();this.currentPage=page;
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    document.getElementById('page-'+page).classList.add('active');
    document.querySelectorAll('.nav-link').forEach(l=>{l.classList.toggle('active',l.dataset.page===page);});
    if(page==='test')this.initTest();
    if(page==='stats')this.renderStats();
    if(page==='home')this.renderHome();
    if(page==='leaderboard')this.renderLeaderboard();
    if(page==='insights')this.renderInsights();
    if(page==='games')this.initGames();
  }
  // Typing Test
  bindTest(){
    document.querySelectorAll('#mode-group .btn-chip').forEach(btn=>{
      btn.addEventListener('click',()=>{
        document.querySelectorAll('#mode-group .btn-chip').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');this.testMode=btn.dataset.mode;
        if(this.testMode==='words'){
          document.getElementById('duration-option-group').classList.add('hidden');
          document.getElementById('words-option-group').classList.remove('hidden');
        }else{
          document.getElementById('duration-option-group').classList.remove('hidden');
          document.getElementById('words-option-group').classList.add('hidden');
        }
        this.initTest();
      });
    });
    document.querySelectorAll('#words-group .btn-chip').forEach(btn=>{
      btn.addEventListener('click',()=>{
        document.querySelectorAll('#words-group .btn-chip').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');this.testWords=parseInt(btn.dataset.words);this.initTest();
      });
    });
    document.querySelectorAll('#duration-group .btn-chip').forEach(btn=>{
      btn.addEventListener('click',()=>{
        document.querySelectorAll('#duration-group .btn-chip').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');this.testDuration=parseInt(btn.dataset.duration);this.initTest();
      });
    });
    document.querySelectorAll('#difficulty-group .btn-chip').forEach(btn=>{
      btn.addEventListener('click',()=>{
        document.querySelectorAll('#difficulty-group .btn-chip').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');this.difficulty=btn.dataset.difficulty;this.initTest();
      });
    });
    document.getElementById('typing-input').addEventListener('input',e=>this.handleInput(e,'test'));
    document.getElementById('typing-input').addEventListener('keydown',e=>{
      if(e.key==='Tab'){e.preventDefault();if(e.shiftKey||document.activeElement===document.getElementById('typing-input'))this.initTest();}
    });
    document.getElementById('restart-test').addEventListener('click',()=>this.initTest());
    document.getElementById('typing-area').addEventListener('click',()=>document.getElementById('typing-input').focus());
    
    const toggleBtn = document.getElementById('toggle-test-heatmap');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        this.testHeatmapActive = !this.testHeatmapActive;
        toggleBtn.classList.toggle('active', this.testHeatmapActive);
        toggleBtn.innerHTML = this.testHeatmapActive ? '🔥 Hide Heatmap' : '🔥 Show Heatmap';
        
        const kb = document.getElementById('virtual-keyboard');
        if (kb) {
          kb.classList.toggle('heatmap', this.testHeatmapActive);
          if (this.testHeatmapActive) {
            this.applyHeatmap('virtual-keyboard');
          } else {
            kb.querySelectorAll('.kb-key').forEach(k => {
              k.removeAttribute('style');
              k.removeAttribute('title');
              k.querySelector('.mistake-badge')?.remove();
            });
            if (this.testText && this.currentIndex < this.testText.length) {
              this.highlightKey('virtual-keyboard', this.testText[this.currentIndex]);
            }
          }
        }
        document.getElementById('typing-input').focus();
      });
    }
  }
  getWords(count=50){
    const list=this.difficulty==='hard'?WORDS_HARD:this.difficulty==='medium'?WORDS_MEDIUM:WORDS_EASY;
    const w=[];for(let i=0;i<count;i++)w.push(list[Math.floor(Math.random()*list.length)]);
    return w.join(' ');
  }
  initTest(){
    this.stopTest();this.testStarted=false;this.currentIndex=0;this.errors=0;
    this.typedChars=[];this.startTime=null;
    if(this.testMode==='words'){
      this.timeLeft=0;
      this.testText=this.getWords(this.testWords);
      document.getElementById('live-timer').textContent='0';
    }else{
      this.timeLeft=this.testDuration;
      this.testText=this.getWords(80);
      document.getElementById('live-timer').textContent=this.timeLeft;
    }
    document.getElementById('live-wpm').textContent='0';
    document.getElementById('live-accuracy').textContent='100';
    document.getElementById('live-errors').textContent='0';
    this.renderText('text-display',this.testText,0,[]);
    const inp=document.getElementById('typing-input');inp.value='';inp.focus();
    const kb = document.getElementById('virtual-keyboard');
    if (kb) {
      if (this.testHeatmapActive) {
        kb.classList.add('heatmap');
        this.applyHeatmap('virtual-keyboard');
      } else {
        kb.classList.remove('heatmap');
        kb.querySelectorAll('.kb-key').forEach(k => {
          k.removeAttribute('style');
          k.removeAttribute('title');
          k.querySelector('.mistake-badge')?.remove();
        });
      }
    }
    this.highlightKey('virtual-keyboard',this.testText[0]);
  }
  handleInput(e,mode){
    const inputEl=mode==='test'?document.getElementById('typing-input'):
      mode==='lesson'?document.getElementById('lesson-typing-input'):document.getElementById('practice-typing-input');
    const displayId=mode==='test'?'text-display':mode==='lesson'?'lesson-text-display':'practice-text-display';
    const text=mode==='test'?this.testText:this.activeText;
    const kbId=mode==='test'?'virtual-keyboard':mode==='lesson'?'lesson-keyboard':'practice-keyboard';
    if(!text)return;
    const val=inputEl.value;
    if(!this.testStarted&&mode==='test'){this.testStarted=true;this.startTime=Date.now();this.startTimer();}
    if(!this.startTime&&mode!=='test'){this.startTime=Date.now();}
    this.typedChars=[];this.errors=0;
    for(let i=0;i<val.length;i++){
      if(i<text.length){
        const correct=val[i]===text[i];
        this.typedChars.push({char:val[i],correct});
        if(!correct)this.errors++;
      }
    }
    if(e && e.inputType === 'insertText' && val.length > 0) {
      const idx = val.length - 1;
      if(idx < text.length && val[idx] !== text[idx]) {
        const expected = text[idx].toLowerCase();
        if(expected !== ' ' && expected !== '\n') {
          this.stats.missedKeys[expected] = (this.stats.missedKeys[expected]||0) + 1;
          this.saveData('tm_stats', this.stats);
          if (this.testHeatmapActive && mode === 'test') {
            this.applyHeatmap('virtual-keyboard');
          }
        }
      }
    }
    this.currentIndex=val.length;
    this.renderText(displayId,text,this.currentIndex,this.typedChars);
    if(this.currentIndex<text.length)this.highlightKey(kbId,text[this.currentIndex]);
    if(this.settings.sound)this.playClick();
    if(!this.typedChars[this.typedChars.length-1]?.correct&&this.settings.errorSound)this.playError();
    // Update live stats
    const elapsed=(Date.now()-this.startTime)/60000;
    const correctChars=this.typedChars.filter(c=>c.correct).length;
    const wpm=elapsed>0?Math.round((correctChars/5)/elapsed):0;
    const acc=this.typedChars.length>0?Math.round((correctChars/this.typedChars.length)*100):100;
    if(mode==='test'){
      document.getElementById('live-wpm').textContent=wpm;
      document.getElementById('live-accuracy').textContent=acc;
      document.getElementById('live-errors').textContent=this.errors;
    }else if(mode==='lesson'){
      document.getElementById('lesson-wpm').textContent=wpm;
      document.getElementById('lesson-accuracy').textContent=acc;
      document.getElementById('lesson-progress').textContent=Math.round((this.currentIndex/text.length)*100);
    }else{
      document.getElementById('practice-wpm').textContent=wpm;
      document.getElementById('practice-accuracy').textContent=acc;
      document.getElementById('practice-progress').textContent=Math.round((this.currentIndex/text.length)*100);
    }
    // Check completion
    if(this.currentIndex>=text.length){
      if(mode==='test'){
        if(this.testMode==='words'){
          this.stopTest();
          this.showResults();
        }
      }else{
        this.completeSession(mode);
      }
    }
  }
  renderText(id,text,pos,typed){
    const el=document.getElementById(id);
    // Group characters into words so whole words wrap together
    let html='';let wordHtml='';
    for(let i=0;i<text.length;i++){
      let cls='upcoming';
      if(i<typed.length)cls=typed[i].correct?'correct':'incorrect';
      else if(i===pos)cls='current';
      const ch=text[i]===' '?'&nbsp;':this.escapeHtml(text[i]);
      wordHtml+=`<span class="char ${cls}">${ch}</span>`;
      if(text[i]===' '||i===text.length-1){
        html+=`<span class="word">${wordHtml}</span>`;
        wordHtml='';
      }
    }
    if(wordHtml) html+=`<span class="word">${wordHtml}</span>`;
    el.innerHTML=html;
    // Auto scroll
    const cur=el.querySelector('.char.current');
    if(cur){
      const r=cur.offsetTop;
      if(r>70) el.style.transform=`translateY(-${r-70}px)`;
      else el.style.transform='translateY(0)';
    } else {
      el.style.transform='translateY(0)';
    }
  }
  escapeHtml(c){return c==='<'?'&lt;':c==='>'?'&gt;':c==='&'?'&amp;':c==='"'?'&quot;':c;}
  startTimer(){
    if(this.testMode==='words'){
      this.elapsedTime=0;
      this.timer=setInterval(()=>{
        this.elapsedTime++;
        document.getElementById('live-timer').textContent=this.elapsedTime;
      },1000);
    }else{
      this.timer=setInterval(()=>{
        this.timeLeft--;document.getElementById('live-timer').textContent=this.timeLeft;
        if(this.timeLeft<=0){this.stopTest();this.showResults();}
      },1000);
    }
  }
  stopTest(){if(this.timer){clearInterval(this.timer);this.timer=null;}}
  showResults(){
    const elapsed=this.testMode==='words'
      ? Math.max(1, Math.round((Date.now() - this.startTime) / 1000))
      : this.testDuration;
    const correctChars=this.typedChars.filter(c=>c.correct).length;
    const totalChars=this.typedChars.length;
    const wpm=Math.round((correctChars/5)/(elapsed/60));
    const raw=Math.round((totalChars/5)/(elapsed/60));
    const acc=totalChars>0?Math.round((correctChars/totalChars)*100):0;
    document.getElementById('result-wpm').textContent=wpm;
    document.getElementById('result-accuracy').textContent=acc+'%';
    document.getElementById('result-correct').textContent=correctChars;
    document.getElementById('result-errors').textContent=this.errors;
    document.getElementById('result-raw').textContent=raw;
    document.getElementById('result-chars').textContent=totalChars;
    let rank='Keep practicing! 💪';
    if(wpm>=100)rank='🏆 Legendary! You are a typing master!';
    else if(wpm>=80)rank='🥇 Excellent! Professional level speed!';
    else if(wpm>=60)rank='🥈 Great! Above average typist!';
    else if(wpm>=40)rank='🥉 Good job! Average typing speed!';
    else if(wpm>=20)rank='📈 Getting there! Keep it up!';
    document.getElementById('result-rank').textContent=rank;
    document.getElementById('results-modal').classList.remove('hidden');
    // Save stats
    this.stats.tests.push({wpm,raw,accuracy:acc,errors:this.errors,chars:totalChars,duration:elapsed,date:new Date().toISOString(),difficulty:this.difficulty});
    this.stats.totalChars+=totalChars;this.stats.totalTime+=elapsed;
    this.saveData('tm_stats',this.stats);
  }
  bindModal(){
    document.getElementById('modal-close').addEventListener('click',()=>document.getElementById('results-modal').classList.add('hidden'));
    document.getElementById('result-close').addEventListener('click',()=>document.getElementById('results-modal').classList.add('hidden'));
    document.getElementById('result-retry').addEventListener('click',()=>{document.getElementById('results-modal').classList.add('hidden');this.initTest();});
  }
  // Lessons
  bindLessons(){
    document.getElementById('lesson-back').addEventListener('click',()=>{
      document.getElementById('lesson-active').classList.add('hidden');
      document.querySelector('#page-lessons .lessons-grid').style.display='';
      document.querySelector('#page-lessons .page-title').style.display='';
      document.querySelector('#page-lessons .page-desc').style.display='';
    });
    document.getElementById('lesson-typing-input').addEventListener('input',e=>this.handleInput(e,'lesson'));
    document.getElementById('lesson-typing-area').addEventListener('click',()=>document.getElementById('lesson-typing-input').focus());
  }
  renderLessons(){
    const grid=document.getElementById('lessons-grid');grid.innerHTML='';
    LESSONS.forEach((lesson,i)=>{
      const done=this.stats.lessonsCompleted.includes(lesson.id);
      const locked=i>0&&!this.stats.lessonsCompleted.includes(LESSONS[i-1].id)&&!done;
      const card=document.createElement('div');
      card.className='lesson-card'+(done?' completed':'')+(locked?' locked':'');
      card.innerHTML=`<div class="lesson-num">Lesson ${lesson.id}</div><h3>${lesson.title}</h3><p>${lesson.desc}</p>
        <div class="lesson-keys">${lesson.keys.map(k=>`<span class="lesson-key-tag">${k}</span>`).join('')}</div>`;
      if(!locked)card.addEventListener('click',()=>this.startLesson(lesson));
      grid.appendChild(card);
    });
  }
  startLesson(lesson){
    this.activeLessonId=lesson.id;this.activeText=lesson.text;this.activeMode='lesson';
    this.currentIndex=0;this.errors=0;this.typedChars=[];this.startTime=null;
    document.querySelector('#page-lessons .lessons-grid').style.display='none';
    document.querySelector('#page-lessons .page-title').style.display='none';
    document.querySelector('#page-lessons .page-desc').style.display='none';
    document.getElementById('lesson-active').classList.remove('hidden');
    document.getElementById('lesson-active-title').textContent=lesson.title;
    document.getElementById('lesson-active-desc').textContent=lesson.desc;
    document.getElementById('lesson-focus-keys').innerHTML=lesson.keys.map(k=>`<span class="focus-key">${k}</span>`).join('');
    document.getElementById('lesson-wpm').textContent='0';
    document.getElementById('lesson-accuracy').textContent='100';
    document.getElementById('lesson-progress').textContent='0';
    this.renderText('lesson-text-display',this.activeText,0,[]);
    this.buildKeyboard('lesson-keyboard');
    document.getElementById('lesson-typing-input').value='';
    document.getElementById('lesson-typing-input').focus();
    if(this.activeText[0])this.highlightKey('lesson-keyboard',this.activeText[0]);
  }
  completeSession(mode){
    if(mode==='lesson'&&this.activeLessonId){
      if(!this.stats.lessonsCompleted.includes(this.activeLessonId)){
        this.stats.lessonsCompleted.push(this.activeLessonId);
        this.saveData('tm_stats',this.stats);
      }
      const elapsed=(Date.now()-this.startTime)/60000;
      const cc=this.typedChars.filter(c=>c.correct).length;
      const wpm=Math.round((cc/5)/elapsed);
      const acc=Math.round((cc/this.typedChars.length)*100);
      alert(`Lesson Complete! 🎉\nWPM: ${wpm} | Accuracy: ${acc}%`);
      this.renderLessons();
      document.getElementById('lesson-back').click();
    }else if(mode==='practice'){
      const elapsed=(Date.now()-this.startTime)/60000;
      const cc=this.typedChars.filter(c=>c.correct).length;
      const wpm=Math.round((cc/5)/elapsed);
      const acc=Math.round((cc/this.typedChars.length)*100);
      this.stats.tests.push({wpm,accuracy:acc,errors:this.errors,chars:this.typedChars.length,duration:Math.round(elapsed*60),date:new Date().toISOString(),difficulty:'practice'});
      this.stats.totalChars+=this.typedChars.length;this.stats.totalTime+=Math.round(elapsed*60);
      this.saveData('tm_stats',this.stats);
      alert(`Practice Complete! 🎉\nWPM: ${wpm} | Accuracy: ${acc}%`);
    }
  }
  // Practice
  bindPractice(){
    document.querySelectorAll('.practice-cat-card').forEach(card=>{
      card.addEventListener('click',()=>this.startPractice(card.dataset.category));
    });
    document.getElementById('practice-back').addEventListener('click',()=>{
      document.getElementById('practice-active').classList.add('hidden');
      document.getElementById('practice-categories').style.display='';
    });
    document.getElementById('practice-typing-input').addEventListener('input',e=>this.handleInput(e,'practice'));
    document.getElementById('practice-typing-area').addEventListener('click',()=>document.getElementById('practice-typing-input').focus());
    document.getElementById('practice-next').addEventListener('click',()=>this.startPractice(this.activeCategory));
    document.getElementById('practice-restart').addEventListener('click',()=>{
      this.currentIndex=0;this.errors=0;this.typedChars=[];this.startTime=null;
      document.getElementById('practice-typing-input').value='';
      this.renderText('practice-text-display',this.activeText,0,[]);
      document.getElementById('practice-wpm').textContent='0';
      document.getElementById('practice-accuracy').textContent='100';
      document.getElementById('practice-progress').textContent='0';
      document.getElementById('practice-typing-input').focus();
    });
    document.getElementById('start-custom').addEventListener('click',()=>{
      const t=document.getElementById('custom-textarea').value.trim();
      if(t){this.activeText=t;this.currentIndex=0;this.errors=0;this.typedChars=[];this.startTime=null;
        document.getElementById('practice-typing-input').value='';
        this.renderText('practice-text-display',this.activeText,0,[]);
        document.getElementById('custom-text-input').classList.add('hidden');
        document.getElementById('practice-typing-input').focus();}
    });
  }
  startPractice(category){
    this.activeCategory=category;this.activeMode='practice';
    this.currentIndex=0;this.errors=0;this.typedChars=[];this.startTime=null;
    document.getElementById('practice-categories').style.display='none';
    document.getElementById('practice-active').classList.remove('hidden');
    document.getElementById('custom-text-input').classList.add('hidden');
    const titles={quotes:'Famous Quotes',code:'Code Snippets',paragraphs:'Paragraphs',custom:'Custom Text'};
    document.getElementById('practice-active-title').textContent=titles[category]||'Practice';
    if(category==='custom'){
      document.getElementById('custom-text-input').classList.remove('hidden');
      this.activeText='';
    }else{
      const list=category==='quotes'?QUOTES:category==='code'?CODE_SNIPPETS:PARAGRAPHS;
      this.activeText=list[Math.floor(Math.random()*list.length)];
    }
    if(this.activeText){
      this.renderText('practice-text-display',this.activeText,0,[]);
      this.highlightKey('practice-keyboard',this.activeText[0]);
    }
    this.buildKeyboard('practice-keyboard');
    document.getElementById('practice-wpm').textContent='0';
    document.getElementById('practice-accuracy').textContent='100';
    document.getElementById('practice-progress').textContent='0';
    document.getElementById('practice-typing-input').value='';
    document.getElementById('practice-typing-input').focus();
  }
  // Games
  bindGames(){
    document.querySelectorAll('.game-card').forEach(card=>{
      if(card.dataset.game==='cascade') card.addEventListener('click',()=>this.startCascade());
      if(card.dataset.game==='bubble') card.addEventListener('click',()=>this.startBubble());
      if(card.dataset.game==='dash') card.addEventListener('click',()=>this.startDash());
      if(card.dataset.game==='code') card.addEventListener('click',()=>this.startCode());
    });
    document.getElementById('game-back').addEventListener('click',()=>this.stopGame());
    document.getElementById('start-cascade-btn').addEventListener('click',()=>this.runCascade());
    document.getElementById('game-input').addEventListener('input',e=>this.handleCascadeInput(e));
    
    document.getElementById('game-bubble-back').addEventListener('click',()=>this.stopGame());
    document.getElementById('start-bubble-btn').addEventListener('click',()=>this.runBubble());
    document.getElementById('game-bubble-input').addEventListener('input',e=>this.handleBubbleInput(e));

    document.getElementById('game-dash-back').addEventListener('click',()=>this.stopGame());
    document.getElementById('start-dash-btn').addEventListener('click',()=>this.runDash());
    document.getElementById('game-dash-input').addEventListener('input',e=>this.handleDashInput(e));

    document.getElementById('game-code-back').addEventListener('click',()=>this.stopGame());
    document.getElementById('start-code-btn').addEventListener('click',()=>this.runCode());
    document.getElementById('game-code-input').addEventListener('input',e=>this.handleCodeInput(e));
  }
  initGames(){
    document.getElementById('games-selection').classList.remove('hidden');
    document.getElementById('game-cascade-active').classList.add('hidden');
    document.getElementById('game-bubble-active').classList.add('hidden');
    document.getElementById('game-dash-active').classList.add('hidden');
    document.getElementById('game-code-active').classList.add('hidden');
  }
  startCascade(){
    document.getElementById('games-selection').classList.add('hidden');
    document.getElementById('game-cascade-active').classList.remove('hidden');
    document.getElementById('game-start-overlay').classList.remove('hidden');
    document.getElementById('game-score').textContent='0';
    document.getElementById('game-level').textContent='1';
    document.getElementById('game-lives').textContent='❤️❤️❤️';
    this.gameActive=false;
  }
  runCascade(){
    document.getElementById('game-start-overlay').classList.add('hidden');
    document.getElementById('game-input').focus();
    this.gameActive=true;
    this.gameScore=0;this.gameLevel=1;this.gameLives=3;
    this.gameWords=[];this.spawnInterval=3000;this.lastSpawn=0;this.gameSpeed=1;
    this.wordIdCounter=0;this.currentTarget=null;
    this.updateGame();
  }
  stopGame(){
    this.gameActive=false;
    const canvas=document.getElementById('game-canvas');
    canvas.querySelectorAll('.falling-word, .score-popup').forEach(w=>w.remove());
    const bubbleCanvas=document.getElementById('game-bubble-canvas');
    bubbleCanvas.querySelectorAll('.bubble, .score-popup').forEach(b=>b.remove());
    document.querySelectorAll('.score-popup').forEach(p=>p.remove());
    
    document.getElementById('game-cascade-active').classList.add('hidden');
    document.getElementById('game-bubble-active').classList.add('hidden');
    document.getElementById('game-dash-active').classList.add('hidden');
    document.getElementById('game-code-active').classList.add('hidden');
    document.getElementById('games-selection').classList.remove('hidden');
  }
  updateGame(){
    if(!this.gameActive)return;
    const now=Date.now();
    const canvas=document.getElementById('game-canvas');
    const canvasRect=canvas.getBoundingClientRect();

    // Spawning
    if(now - this.lastSpawn > this.spawnInterval){
      this.spawnWord();
      this.lastSpawn=now;
      this.spawnInterval = Math.max(800, 3000 - (this.gameLevel * 200));
      this.gameSpeed = 1 + (this.gameLevel * 0.15);
    }

    // Movement
    for(let i = this.gameWords.length - 1; i >= 0; i--){
      const w = this.gameWords[i];
      w.y += this.gameSpeed;
      w.element.style.transform=`translateY(${w.y}px)`;
      
      if(w.y > canvasRect.height - 40){
        this.gameLives--;
        this.updateGameStats();
        w.element.remove();
        this.gameWords.splice(i,1);
        if(this.currentTarget && this.currentTarget.id === w.id) this.currentTarget = null;
        if(this.gameLives<=0)this.gameOver();
        this.playError();
      }
    }

    requestAnimationFrame(()=>this.updateGame());
  }
  spawnWord(){
    const canvas=document.getElementById('game-canvas');
    const wordList = this.gameLevel > 5 ? WORDS_HARD : this.gameLevel > 2 ? WORDS_MEDIUM : WORDS_EASY;
    const text=wordList[Math.floor(Math.random()*wordList.length)];
    const x=Math.random()*(canvas.clientWidth - 150);
    const id=this.wordIdCounter++;
    
    const el=document.createElement('div');
    el.className='falling-word';
    el.style.left=x+'px';
    el.innerHTML=`<span>${this.escapeHtml(text)}</span>`;
    canvas.appendChild(el);
    
    this.gameWords.push({id, text, x, y:0, element:el, typed:''});
  }
  handleCascadeInput(e){
    if(!this.gameActive)return;
    const val=e.target.value.toLowerCase().trim();
    if(!val){
      this.currentTarget = null;
      this.gameWords.forEach(w => {
        w.element.classList.remove('active-match');
        w.element.innerHTML=`<span>${this.escapeHtml(w.text)}</span>`;
      });
      return;
    }

    let matched=false;
    for(let i = this.gameWords.length - 1; i >= 0; i--){
      const w = this.gameWords[i];
      
      // If we have a target, only match that one
      if(this.currentTarget && this.currentTarget.id !== w.id){
        w.element.classList.remove('active-match');
        w.element.innerHTML=`<span>${this.escapeHtml(w.text)}</span>`;
        continue;
      }

      if(w.text.toLowerCase().startsWith(val)){
        matched=true;
        this.currentTarget = w;
        w.element.classList.add('active-match');
        w.element.innerHTML=`<span class="correct">${this.escapeHtml(w.text.substring(0, val.length))}</span><span>${this.escapeHtml(w.text.substring(val.length))}</span>`;
        
        if(w.text.toLowerCase()===val){
          this.gameScore += w.text.length * 10;
          if(this.gameScore > this.gameLevel * 500) this.gameLevel++;
          this.updateGameStats();
          this.spawnPop(w.x, w.y, `+${w.text.length * 10}`);
          w.element.remove();
          this.gameWords.splice(i,1);
          this.currentTarget = null;
          e.target.value='';
          this.playClick();
        }
      } else {
        w.element.classList.remove('active-match');
        w.element.innerHTML=`<span>${this.escapeHtml(w.text)}</span>`;
      }
    }
    
    if(!matched) {
      // If the typed value doesn't match the current target or any other word, 
      // we might want to show an error state, but let's just clear target if value is empty (handled above)
    }
  }
  spawnPop(x, y, text, canvasId = 'game-canvas'){
    const canvas=document.getElementById(canvasId);
    const pop=document.createElement('div');
    pop.className='score-popup';
    pop.style.left=x+'px';
    pop.style.top=y+'px';
    pop.textContent=text;
    canvas.appendChild(pop);
    setTimeout(()=>pop.remove(),800);
  }
  updateGameStats(){
    document.getElementById('game-score').textContent=this.gameScore;
    document.getElementById('game-level').textContent=this.gameLevel;
    document.getElementById('game-lives').textContent='❤️'.repeat(Math.max(0,this.gameLives));
  }
  gameOver(){
    this.gameActive=false;
    const canvas=document.getElementById('game-canvas');
    const overlay=document.getElementById('game-start-overlay');
    overlay.classList.remove('hidden');
    overlay.innerHTML=`
      <h2 class="game-over-msg">Game Over</h2>
      <p>Final Score: <span style="color:var(--accent);font-weight:800">${this.gameScore}</span></p>
      <p>Level Reached: ${this.gameLevel}</p>
      <button class="btn btn-primary btn-lg" id="restart-cascade-btn">Try Again</button>
      <button class="btn btn-secondary btn-lg" id="quit-cascade-btn" style="margin-top:12px">Quit to Menu</button>
    `;
    document.getElementById('restart-cascade-btn').addEventListener('click',()=>this.runCascade());
    document.getElementById('quit-cascade-btn').addEventListener('click',()=>this.stopGame());
    this.saveResultToServer(0,0,100,0,0,0,`Level ${this.gameLevel}`,'game');
  }
  // Bubble Pop Game
  startBubble(){
    document.getElementById('games-selection').classList.add('hidden');
    document.getElementById('game-bubble-active').classList.remove('hidden');
    document.getElementById('game-bubble-start-overlay').classList.remove('hidden');
    document.getElementById('game-bubble-score').textContent='0';
    document.getElementById('game-bubble-level').textContent='1';
    document.getElementById('game-bubble-lives').textContent='❤️❤️❤️';
    this.gameActive=false;
  }
  runBubble(){
    document.getElementById('game-bubble-start-overlay').classList.add('hidden');
    document.getElementById('game-bubble-input').focus();
    this.gameActive=true;
    this.gameScore=0;this.gameLevel=1;this.gameLives=3;
    this.gameBubbles=[];this.spawnInterval=2000;this.lastSpawn=0;this.gameSpeed=1;
    this.updateBubbleGame();
  }
  updateBubbleGame(){
    if(!this.gameActive)return;
    const now=Date.now();
    const canvas=document.getElementById('game-bubble-canvas');
    const canvasRect=canvas.getBoundingClientRect();

    if(now - this.lastSpawn > this.spawnInterval){
      this.spawnBubble();
      this.lastSpawn=now;
      this.spawnInterval = Math.max(500, 2000 - (this.gameLevel * 150));
      this.gameSpeed = 1 + (this.gameLevel * 0.2);
    }

    for(let i = this.gameBubbles.length - 1; i >= 0; i--){
      const b = this.gameBubbles[i];
      b.y -= this.gameSpeed;
      b.element.style.transform=`translateY(${b.y}px)`;
      
      if(b.y < -canvasRect.height + 50){
        this.gameLives--;
        this.updateBubbleStats();
        b.element.remove();
        this.gameBubbles.splice(i,1);
        if(this.gameLives<=0)this.gameBubbleOver();
        this.playError();
      }
    }
    requestAnimationFrame(()=>this.updateBubbleGame());
  }
  spawnBubble(){
    const canvas=document.getElementById('game-bubble-canvas');
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const text = chars[Math.floor(Math.random()*chars.length)];
    const x=Math.random()*(canvas.clientWidth - 80);
    const y=canvas.clientHeight;
    
    const el=document.createElement('div');
    el.className='bubble';
    el.style.left=x+'px';
    el.style.bottom='0px';
    el.textContent=text;
    canvas.appendChild(el);
    
    this.gameBubbles.push({text, x, y:0, element:el});
  }
  handleBubbleInput(e){
    if(!this.gameActive)return;
    const val=e.target.value.toUpperCase();
    if(!val)return;
    const char = val[val.length-1];
    e.target.value='';

    for(let i = this.gameBubbles.length - 1; i >= 0; i--){
      const b = this.gameBubbles[i];
      if(b.text === char){
        this.gameScore += 50;
        if(this.gameScore > this.gameLevel * 1000) this.gameLevel++;
        this.updateBubbleStats();
        const bc = document.getElementById('game-bubble-canvas');
        this.spawnPop(b.x, bc.clientHeight - Math.abs(b.y) - 60, `+50`, 'game-bubble-canvas');
        b.element.classList.add('pop');
        setTimeout(()=>b.element.remove(),300);
        this.gameBubbles.splice(i,1);
        this.playClick();
        return; // Only pop one bubble per keystroke
      }
    }
  }
  updateBubbleStats(){
    document.getElementById('game-bubble-score').textContent=this.gameScore;
    document.getElementById('game-bubble-level').textContent=this.gameLevel;
    document.getElementById('game-bubble-lives').textContent='❤️'.repeat(Math.max(0,this.gameLives));
  }
  gameBubbleOver(){
    this.gameActive=false;
    const overlay=document.getElementById('game-bubble-start-overlay');
    overlay.classList.remove('hidden');
    overlay.innerHTML=`
      <h2 class="game-over-msg">Game Over</h2>
      <p>Final Score: <span style="color:var(--accent);font-weight:800">${this.gameScore}</span></p>
      <button class="btn btn-primary btn-lg" id="restart-bubble-btn">Try Again</button>
      <button class="btn btn-secondary btn-lg" id="quit-bubble-btn" style="margin-top:12px">Quit to Menu</button>
    `;
    document.getElementById('restart-bubble-btn').addEventListener('click',()=>this.runBubble());
    document.getElementById('quit-bubble-btn').addEventListener('click',()=>this.stopGame());
  }
  // Word Dash
  startDash(){
    document.getElementById('games-selection').classList.add('hidden');
    document.getElementById('game-dash-active').classList.remove('hidden');
    document.getElementById('game-dash-start-overlay').classList.remove('hidden');
    document.getElementById('game-dash-score').textContent='0';
    document.getElementById('game-dash-level').textContent='1';
    document.getElementById('game-dash-lives').textContent='❤️❤️❤️';
    document.getElementById('dash-word-display').innerHTML='READY';
    document.getElementById('dash-timer-bar').style.width='100%';
    this.gameActive=false;
  }
  runDash(){
    document.getElementById('game-dash-start-overlay').classList.add('hidden');
    document.getElementById('game-dash-input').focus();
    this.gameActive=true;
    this.gameScore=0;this.gameLevel=1;this.gameLives=3;
    this.dashTimeLimit=4000; 
    this.nextDashWord();
    this.lastDashUpdate=Date.now();
    this.updateDashGame();
  }
  nextDashWord(){
    const wordList = this.gameLevel > 10 ? WORDS_HARD : this.gameLevel > 4 ? WORDS_MEDIUM : WORDS_EASY;
    this.dashCurrentWord = wordList[Math.floor(Math.random()*wordList.length)];
    this.dashTimeLeft = this.dashTimeLimit;
    this.renderDashWord('');
    document.getElementById('game-dash-input').value = '';
  }
  renderDashWord(typed){
    let html = `<span class="typed">${this.escapeHtml(this.dashCurrentWord.substring(0, typed.length))}</span>`;
    html += `<span>${this.escapeHtml(this.dashCurrentWord.substring(typed.length))}</span>`;
    document.getElementById('dash-word-display').innerHTML = html;
  }
  updateDashGame(){
    if(!this.gameActive) return;
    const now=Date.now();
    const dt = now - this.lastDashUpdate;
    this.lastDashUpdate = now;
    
    this.dashTimeLeft -= dt;
    const pct = Math.max(0, (this.dashTimeLeft / this.dashTimeLimit) * 100);
    const bar = document.getElementById('dash-timer-bar');
    bar.style.width = pct + '%';
    if(pct < 30) bar.classList.add('warning');
    else bar.classList.remove('warning');

    if(this.dashTimeLeft <= 0){
      this.gameLives--;
      this.updateDashStats();
      this.playError();
      if(this.gameLives <= 0){
        this.gameDashOver();
      } else {
        document.getElementById('dash-word-display').classList.add('error-shake');
        setTimeout(()=>document.getElementById('dash-word-display').classList.remove('error-shake'), 200);
        this.nextDashWord();
      }
    }
    
    if(this.gameActive) requestAnimationFrame(()=>this.updateDashGame());
  }
  handleDashInput(e){
    if(!this.gameActive)return;
    const val=e.target.value.toLowerCase().trim();
    if(!val) { this.renderDashWord(''); return; }
    
    if(this.dashCurrentWord.toLowerCase().startsWith(val)){
      this.renderDashWord(val);
      if(val === this.dashCurrentWord.toLowerCase()){
        const timeBonus = Math.round((this.dashTimeLeft / this.dashTimeLimit) * 50);
        const pts = (this.dashCurrentWord.length * 10) + timeBonus;
        this.gameScore += pts;
        if(this.gameScore > this.gameLevel * 800) {
          this.gameLevel++;
          this.dashTimeLimit = Math.max(1000, 4000 - (this.gameLevel * 200));
        }
        this.updateDashStats();
        this.playClick();
        
        const disp = document.getElementById('dash-word-display');
        const rect = disp.getBoundingClientRect();
        const canvasRect = document.getElementById('game-dash-canvas').getBoundingClientRect();
        this.spawnPop(rect.left - canvasRect.left + rect.width/2, rect.top - canvasRect.top, `+${pts}`, 'game-dash-canvas');
        
        this.nextDashWord();
      }
    } else {
      document.getElementById('dash-word-display').classList.add('error-shake');
      setTimeout(()=>document.getElementById('dash-word-display').classList.remove('error-shake'), 200);
    }
  }
  updateDashStats(){
    document.getElementById('game-dash-score').textContent=this.gameScore;
    document.getElementById('game-dash-level').textContent=this.gameLevel;
    document.getElementById('game-dash-lives').textContent='❤️'.repeat(Math.max(0,this.gameLives));
  }
  gameDashOver(){
    this.gameActive=false;
    const overlay=document.getElementById('game-dash-start-overlay');
    overlay.classList.remove('hidden');
    overlay.innerHTML=`
      <h2 class="game-over-msg">Game Over</h2>
      <p>Final Score: <span style="color:var(--accent);font-weight:800">${this.gameScore}</span></p>
      <button class="btn btn-primary btn-lg" id="restart-dash-btn">Try Again</button>
      <button class="btn btn-secondary btn-lg" id="quit-dash-btn" style="margin-top:12px">Quit to Menu</button>
    `;
    document.getElementById('restart-dash-btn').addEventListener('click',()=>this.runDash());
    document.getElementById('quit-dash-btn').addEventListener('click',()=>this.stopGame());
  }

  // Code Breaker
  startCode(){
    document.getElementById('games-selection').classList.add('hidden');
    document.getElementById('game-code-active').classList.remove('hidden');
    document.getElementById('game-code-start-overlay').classList.remove('hidden');
    document.getElementById('game-code-score').textContent='0';
    document.getElementById('game-code-level').textContent='0';
    document.getElementById('game-code-lives').textContent='❤️❤️❤️';
    document.getElementById('code-word-display').textContent='???';
    this.gameActive=false;
  }
  runCode(){
    document.getElementById('game-code-start-overlay').classList.add('hidden');
    document.getElementById('game-code-input').focus();
    this.gameActive=true;
    this.gameScore=0;this.gameLevel=0;this.gameLives=3;
    this.nextCodeWord();
  }
  nextCodeWord(){
    const wordList = this.gameLevel > 15 ? WORDS_HARD : this.gameLevel > 5 ? WORDS_MEDIUM : WORDS_EASY;
    this.codeActualWord = wordList[Math.floor(Math.random()*wordList.length)];
    let arr = this.codeActualWord.split('');
    for(let i=arr.length-1; i>0; i--){
      const j = Math.floor(Math.random()*(i+1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    if(arr.join('') === this.codeActualWord && this.codeActualWord.length > 1) {
      [arr[0], arr[1]] = [arr[1], arr[0]];
    }
    this.codeScrambled = arr.join('').toUpperCase();
    document.getElementById('code-word-display').textContent = this.codeScrambled;
    document.getElementById('game-code-input').value = '';
  }
  handleCodeInput(e){
    if(!this.gameActive)return;
    const inputEl = document.getElementById('game-code-input');
    const val = inputEl.value;
    
    // Check if the user pressed enter or space
    if(val.includes(' ') || val.includes('\n') || e.inputType === 'insertLineBreak'){
      const cleanVal = val.replace(/\s+/g, '').toLowerCase();
      if(!cleanVal) return;
      
      if(cleanVal === this.codeActualWord.toLowerCase()){
        const pts = this.codeActualWord.length * 20;
        this.gameScore += pts;
        this.gameLevel++; // number solved
        this.updateCodeStats();
        this.playClick();
        
        const disp = document.getElementById('code-word-display');
        const rect = disp.getBoundingClientRect();
        const canvasRect = document.getElementById('game-code-canvas').getBoundingClientRect();
        this.spawnPop(rect.left - canvasRect.left + rect.width/2, rect.top - canvasRect.top, `+${pts}`, 'game-code-canvas');
        
        this.nextCodeWord();
      } else {
        this.gameLives--;
        this.updateCodeStats();
        this.playError();
        document.getElementById('code-word-display').classList.add('error-shake');
        setTimeout(()=>document.getElementById('code-word-display').classList.remove('error-shake'), 200);
        inputEl.value = '';
        if(this.gameLives <= 0) this.gameCodeOver();
      }
    }
  }
  updateCodeStats(){
    document.getElementById('game-code-score').textContent=this.gameScore;
    document.getElementById('game-code-level').textContent=this.gameLevel;
    document.getElementById('game-code-lives').textContent='❤️'.repeat(Math.max(0,this.gameLives));
  }
  gameCodeOver(){
    this.gameActive=false;
    const overlay=document.getElementById('game-code-start-overlay');
    overlay.classList.remove('hidden');
    overlay.innerHTML=`
      <h2 class="game-over-msg">Game Over</h2>
      <p>Final Score: <span style="color:var(--accent);font-weight:800">${this.gameScore}</span></p>
      <p>The word was: <span style="color:var(--green);font-weight:800">${this.codeActualWord.toUpperCase()}</span></p>
      <button class="btn btn-primary btn-lg" id="restart-code-btn">Try Again</button>
      <button class="btn btn-secondary btn-lg" id="quit-code-btn" style="margin-top:12px">Quit to Menu</button>
    `;
    document.getElementById('restart-code-btn').addEventListener('click',()=>this.runCode());
    document.getElementById('quit-code-btn').addEventListener('click',()=>this.stopGame());
  }

  // Stats
  renderHome(){
    const t=this.stats.tests;
    document.getElementById('home-best-wpm').textContent=t.length?Math.max(...t.map(x=>x.wpm)):0;
    document.getElementById('home-avg-accuracy').textContent=t.length?Math.round(t.reduce((a,x)=>a+x.accuracy,0)/t.length)+'%':'0%';
    document.getElementById('home-total-tests').textContent=t.length;
    document.getElementById('home-lessons-done').textContent=this.stats.lessonsCompleted.length;
  }
  renderStats(){
    const t=this.stats.tests;
    document.getElementById('stats-best-wpm').textContent=t.length?Math.max(...t.map(x=>x.wpm||0)):0;
    const avgWpm=t.length?Math.round(t.reduce((a,x)=>a+(x.wpm||0),0)/t.length):0;
    document.getElementById('stats-avg-wpm').textContent=avgWpm;
    document.getElementById('stats-avg-acc').textContent=t.length?Math.round(t.reduce((a,x)=>a+(x.accuracy||0),0)/t.length)+'%':'0%';
    document.getElementById('stats-total-tests').textContent=t.length;
    document.getElementById('stats-total-time').textContent=Math.round(this.stats.totalTime/60)+'m';
    document.getElementById('stats-total-chars').textContent=this.stats.totalChars;
    
    // Deep Analysis
    if(t.length > 1){
      const sumSq = t.reduce((a, x) => a + Math.pow((x.wpm||0) - avgWpm, 2), 0);
      const variance = sumSq / t.length;
      const stdDev = Math.sqrt(variance);
      let cons = Math.max(0, 100 - (stdDev / Math.max(avgWpm, 1)) * 100);
      document.getElementById('stats-consistency').textContent = Math.round(cons) + '%';
      
      let profile = 'Novice';
      if(avgWpm > 100) profile = 'Grandmaster';
      else if(avgWpm > 80 && cons > 85) profile = 'Consistent Pro';
      else if(avgWpm > 70) profile = 'Speedster';
      else if(cons > 90) profile = 'Steady Typist';
      else if(stdDev > 20) profile = 'Burst Typist';
      else if(avgWpm > 40) profile = 'Intermediate';
      document.getElementById('stats-typing-style').textContent = profile;
    } else {
      document.getElementById('stats-consistency').textContent = 'N/A';
      document.getElementById('stats-typing-style').textContent = 'Need more tests';
    }
    
    // Missed Keys Analysis
    if(this.stats.missedKeys && Object.keys(this.stats.missedKeys).length > 0){
      const keys = Object.entries(this.stats.missedKeys).sort((a,b)=>b[1]-a[1]).slice(0,3);
      document.getElementById('stats-missed-keys').textContent = keys.map(k=>k[0].toUpperCase()).join(' ');
    } else {
      document.getElementById('stats-missed-keys').textContent = '-';
    }

    // Filter out game results and practice for the WPM/Acc charts
    const chartData = t.filter(x => x.difficulty !== 'practice' && !String(x.difficulty).includes('Level'));
    this.drawChart('wpm-chart', chartData.slice(-20).map(x=>x.wpm),'WPM','#00d4ff');
    this.drawChart('accuracy-chart', chartData.slice(-20).map(x=>x.accuracy),'Accuracy','#22c55e');
    
    // History
    const list=document.getElementById('history-list');list.innerHTML='';
    t.slice(-15).reverse().forEach(test=>{
      const d=new Date(test.date);
      const isGame = String(test.difficulty).includes('Level');
      const val = isGame ? test.difficulty : `${test.wpm} WPM`;
      const label = isGame ? 'Game' : test.difficulty || 'Test';
      list.innerHTML+=`<div class="history-item">
        <span class="hi-wpm" style="${isGame?'color:var(--purple)':''}">${val}</span>
        <span class="hi-acc">${label}</span>
        <span class="hi-date">${d.toLocaleDateString()}</span>
      </div>`;
    });
    if(!t.length)list.innerHTML='<p style="color:var(--text-muted);text-align:center;padding:20px;">No tests yet. Take a speed test to see your stats!</p>';
    
    // Render and apply weakest keys heatmap to keyboard
    this.buildKeyboard('stats-heatmap-keyboard');
    const statsKb = document.getElementById('stats-heatmap-keyboard');
    if (statsKb) statsKb.classList.add('heatmap');
    this.applyHeatmap('stats-heatmap-keyboard');
  }
  async renderLeaderboard(){
    const tbody=document.getElementById('leaderboard-body');
    tbody.innerHTML='<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-muted)">Loading leaderboard...</td></tr>';
    try {
      const res=await fetch('/api/leaderboard');
      const data=await res.json();
      if(!data.leaders||!data.leaders.length) {
        tbody.innerHTML='<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-muted)">No data yet. Be the first to take a test!</td></tr>';
        return;
      }
      tbody.innerHTML='';
      data.leaders.forEach((l,i)=>{
        const rankCls=i<3?`lb-rank-${i+1}`:'';
        const rankIcon=i===0?'🥇':i===1?'🥈':i===2?'🥉':'';
        tbody.innerHTML+=`<tr>
          <td class="lb-rank ${rankCls}">${rankIcon} #${i+1}</td>
          <td class="lb-name">
            <div class="user-avatar" style="width:28px;height:28px;font-size:12px">${l.display_name[0].toUpperCase()}</div>
            ${this.escapeHtml(l.display_name)}
          </td>
          <td class="lb-wpm">${l.best_wpm}</td>
          <td>${l.avg_accuracy}%</td>
          <td>${l.total_tests}</td>
        </tr>`;
      });
    } catch(e) {
      tbody.innerHTML='<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--red)">Failed to load leaderboard. Server might be offline.</td></tr>';
    }
  }
  async renderInsights(){
    try {
      const res = await fetch('/api/admin/stats');
      const data = await res.json();
      
      document.getElementById('insight-total-visits').textContent = data.totalVisits;
      document.getElementById('insight-unique-visitors').textContent = data.uniqueVisitors;
      document.getElementById('insight-avg-sessions').textContent = Math.round(data.totalVisits / Math.max(data.history.length, 1));

      // Traffic Chart
      this.drawChart('traffic-chart', data.history.map(h => h.count), 'Visits', '#8b5cf6');

      // Recent List
      const recentList = document.getElementById('insight-recent-list');
      recentList.innerHTML = '';
      data.recentVisits.slice(0, 10).forEach(v => {
        const d = new Date(v.created_at);
        recentList.innerHTML += `<div class="history-item">
          <span class="hi-wpm" style="font-size:11px;color:var(--text-muted)">${v.ip}</span>
          <span class="hi-date">${d.toLocaleDateString()} ${d.toLocaleTimeString()}</span>
        </div>`;
      });

      // Browser List
      const browserList = document.getElementById('insight-browser-list');
      browserList.innerHTML = '';
      data.browsers.forEach(b => {
        const name = b.user_agent.includes('Chrome') ? 'Chrome' : b.user_agent.includes('Firefox') ? 'Firefox' : b.user_agent.includes('Safari') ? 'Safari' : 'Other';
        browserList.innerHTML += `<div class="history-item">
          <span class="hi-wpm">${name}</span>
          <span class="hi-acc">${b.count} hits</span>
        </div>`;
      });

    } catch(e) {
      console.error('Failed to load insights:', e);
    }
  }
  drawChart(canvasId,data,label,color){
    const canvas=document.getElementById(canvasId);if(!canvas)return;
    const ctx=canvas.getContext('2d');
    const dpr=window.devicePixelRatio||1;
    const rect = canvas.getBoundingClientRect();
    canvas.width=rect.width*dpr;canvas.height=rect.height*dpr;
    ctx.scale(dpr,dpr);const W=rect.width,H=rect.height;
    ctx.clearRect(0,0,W,H);
    if(!data.length){ctx.fillStyle='#64748b';ctx.font='14px Inter';ctx.textAlign='center';ctx.fillText('No data yet',W/2,H/2);return;}
    const max=Math.max(...data,1)*1.2;const pad={t:20,b:30,l:40,r:20};
    const cw=W-pad.l-pad.r,ch=H-pad.t-pad.b;
    // Grid
    ctx.strokeStyle='rgba(255,255,255,0.06)';ctx.lineWidth=1;
    for(let i=0;i<=4;i++){const y=pad.t+ch*(i/4);ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(W-pad.r,y);ctx.stroke();
      ctx.fillStyle='#64748b';ctx.font='11px JetBrains Mono';ctx.textAlign='right';ctx.fillText(Math.round(max*(1-i/4)),pad.l-6,y+4);}
    // Bars + Line
    const bw=Math.min(cw/Math.max(data.length,1)-4,40);
    const grad=ctx.createLinearGradient(0,pad.t,0,H-pad.b);
    grad.addColorStop(0,color);grad.addColorStop(1,color+'33');
    data.forEach((v,i)=>{
      const x=pad.l+(cw/data.length)*i+(cw/data.length-bw)/2;
      const h=(v/max)*ch;const y=pad.t+ch-h;
      ctx.fillStyle=grad;ctx.beginPath();ctx.roundRect(x,y,bw,h,4);ctx.fill();
    });
    // Line
    if(data.length>1){
      ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=2;
      data.forEach((v,i)=>{const x=pad.l+(cw/data.length)*i+cw/data.length/2;const y=pad.t+ch-(v/max)*ch;i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});
      ctx.stroke();
    }
  }
  // Settings
  bindSettings(){
    if(document.getElementById('setting-theme-select')) {
      document.getElementById('setting-theme-select').addEventListener('change',e=>{
        this.settings.theme=e.target.value;
        document.documentElement.setAttribute('data-theme',this.settings.theme);
        this.saveData('tm_settings',this.settings);
      });
    }
    document.getElementById('setting-keyboard').addEventListener('change',e=>{
      this.settings.showKeyboard=e.target.checked;this.applySettings();this.saveData('tm_settings',this.settings);
    });
    document.getElementById('setting-font-size').addEventListener('change',e=>{
      this.settings.fontSize=parseInt(e.target.value);this.applySettings();this.saveData('tm_settings',this.settings);
    });
    if(document.getElementById('setting-font-family')) document.getElementById('setting-font-family').addEventListener('change',e=>{
      this.settings.fontFamily=e.target.value;this.applySettings();this.saveData('tm_settings',this.settings);
    });
    if(document.getElementById('setting-sound-profile')) document.getElementById('setting-sound-profile').addEventListener('change',e=>{
      this.settings.soundProfile=e.target.value;this.saveData('tm_settings',this.settings);
      if(this.settings.sound)this.playClick();
    });
    document.getElementById('setting-sound').addEventListener('change',e=>{this.settings.sound=e.target.checked;this.saveData('tm_settings',this.settings);});
    document.getElementById('setting-error-sound').addEventListener('change',e=>{this.settings.errorSound=e.target.checked;this.saveData('tm_settings',this.settings);});
    document.getElementById('setting-smooth-caret').addEventListener('change',e=>{this.settings.smoothCaret=e.target.checked;this.saveData('tm_settings',this.settings);});
    document.getElementById('setting-live-wpm').addEventListener('change',e=>{this.settings.liveWpm=e.target.checked;this.saveData('tm_settings',this.settings);});
    


    document.getElementById('setting-caret-style')?.addEventListener('change',e=>{
      this.settings.caretStyle=e.target.value;
      document.documentElement.setAttribute('data-caret', this.settings.caretStyle);
      this.saveData('tm_settings',this.settings);
    });

    document.getElementById('reset-stats').addEventListener('click',()=>{
      if(confirm('Reset all stats? This cannot be undone.')){
        this.stats={tests:[],lessonsCompleted:[],totalChars:0,totalTime:0};
        this.saveData('tm_stats',this.stats);this.renderHome();this.renderLessons();alert('Stats reset!');
      }
    });
    document.getElementById('export-data').addEventListener('click',()=>{
      this.exportStatsPDF();
    });
  }
  // Virtual Keyboard
  buildKeyboard(containerId){
    const kb=document.getElementById(containerId);if(!kb)return;kb.innerHTML='';
    KB_LAYOUT.forEach(row=>{
      const rowEl=document.createElement('div');rowEl.className='kb-row';
      row.forEach(key=>{
        const k=document.createElement('div');k.className=`kb-key finger-${key.c}`;
        k.dataset.key=key.k;k.textContent=key.l||key.k;rowEl.appendChild(k);
      });
      kb.appendChild(rowEl);
    });
  }
  highlightKey(kbId,char){
    const kb=document.getElementById(kbId);if(!kb)return;
    kb.querySelectorAll('.kb-key').forEach(k=>k.classList.remove('active'));
    let target=char===' '?'Space':char;
    kb.querySelectorAll('.kb-key').forEach(k=>{
      if(k.dataset.key===target||k.dataset.key===target.toLowerCase())k.classList.add('active');
    });
  }
  applyHeatmap(kbId){
    const kb = document.getElementById(kbId);
    if (!kb) return;
    const missed = this.stats.missedKeys || {};
    const errorVals = Object.entries(missed)
      .filter(([k]) => k.length === 1)
      .map(([, v]) => v);
    const maxErrors = errorVals.length ? Math.max(...errorVals) : 0;
    
    kb.querySelectorAll('.kb-key').forEach(k => {
      const keyChar = k.dataset.key ? k.dataset.key.toLowerCase() : '';
      k.querySelector('.mistake-badge')?.remove();
      
      if (keyChar && missed[keyChar] && keyChar.length === 1) {
        const count = missed[keyChar];
        const intensity = maxErrors > 0 ? count / maxErrors : 0;
        
        // Heat values styled as CSS custom variables for standard compliance
        k.style.setProperty('--key-heat-bg', `rgba(255, 69, 58, ${0.15 + intensity * 0.75})`);
        k.style.setProperty('--key-heat-border', `rgba(255, 69, 58, ${0.35 + intensity * 0.65})`);
        k.style.setProperty('--key-heat-color', `#ffffff`);
        k.style.setProperty('--key-heat-shadow', `0 0 ${4 + intensity * 12}px rgba(255, 69, 58, ${intensity * 0.6})`);
        k.style.setProperty('--key-heat-transform', `scale(${1 + intensity * 0.05})`);
        
        k.title = `${count} mistake${count > 1 ? 's' : ''}`;
        k.style.position = 'relative';
        
        const badge = document.createElement('span');
        badge.className = 'mistake-badge';
        badge.style.position = 'absolute';
        badge.style.top = '2px';
        badge.style.right = '4px';
        badge.style.fontSize = '8px';
        badge.style.fontWeight = '800';
        badge.style.opacity = '0.8';
        badge.style.background = 'rgba(0,0,0,0.5)';
        badge.style.padding = '1px 3px';
        badge.style.borderRadius = '3px';
        badge.style.color = '#ff453a';
        badge.textContent = count;
        k.appendChild(badge);
      } else {
        k.removeAttribute('style');
        k.removeAttribute('title');
      }
    });
  }
  // Sound
  playClick(){
    try{
      if(!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = this.audioCtx;
      if (ctx.state === 'suspended') ctx.resume();
      
      const t = ctx.currentTime + 0.015; // 15ms buffer to prevent scheduling errors
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      const p = this.settings.soundProfile || 'mech_red';
      const profiles = {
        mech_red: {f:800, t:'sine', d:0.04, v:0.25},
        mech_blue: {f:1200, t:'square', d:0.03, v:0.15},
        mech_brown: {f:900, t:'triangle', d:0.05, v:0.2},
        holy_panda: {f:400, t:'triangle', d:0.06, v:0.35},
        topre: {f:300, t:'sine', d:0.08, v:0.3},
        typewriter: {f:2000, t:'square', d:0.02, v:0.1},
        macbook: {f:1500, t:'sine', d:0.02, v:0.15},
        membrane: {f:500, t:'sine', d:0.07, v:0.2},
        laser: {f:1800, t:'sawtooth', d:0.1, v:0.1, sweep:true},
        bubble: {f:600, t:'sine', d:0.05, v:0.3, sweepUp:true},
        clicky: {f:2500, t:'square', d:0.01, v:0.15},
        thock: {f:200, t:'triangle', d:0.08, v:0.4},
        clack: {f:1000, t:'square', d:0.03, v:0.2},
        ping: {f:1800, t:'sine', d:0.15, v:0.15},
        wood: {f:400, t:'square', d:0.04, v:0.25},
        glass: {f:3000, t:'sine', d:0.05, v:0.1},
        soft: {f:300, t:'sine', d:0.1, v:0.2},
        retro: {f:440, t:'square', d:0.1, v:0.2},
        bell: {f:2000, t:'sine', d:0.2, v:0.1},
        snap: {f:1000, t:'sawtooth', d:0.02, v:0.15}
      };
      
      const c = profiles[p] || profiles.mech_red;
      osc.type = c.t;
      osc.frequency.setValueAtTime(c.f, t);
      if(c.sweep) osc.frequency.exponentialRampToValueAtTime(100, t + c.d);
      if(c.sweepUp) osc.frequency.exponentialRampToValueAtTime(1200, t + c.d);
      
      // Slight attack to prevent clicking
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(c.v, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, t + c.d);
      
      osc.start(t);
      osc.stop(t + c.d + 0.05);
      
      // Memory cleanup
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    }catch(e){console.error('Audio error:', e)}
  }
  playError(){try{
    if(!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx=this.audioCtx;
    if (ctx.state === 'suspended') ctx.resume();
    const o=ctx.createOscillator(),g=ctx.createGain();
    o.connect(g);g.connect(ctx.destination);
    o.frequency.value=200;g.gain.value=0.25;o.type='square';
    o.start();o.stop(ctx.currentTime+0.1);
  }catch(e){}}
  // Server sync
  async saveResultToServer(wpm,raw,acc,errors,chars,duration,difficulty,mode){
    if(!this.auth||!this.auth.isLoggedIn())return;
    const payload = {wpm,rawWpm:raw,accuracy:acc,errors,chars,duration,difficulty,mode};
    try{
      const r = await fetch('/api/results',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      if(!r.ok) throw new Error('Server error');
      // If we got online, try syncing any queued results
      this.syncOfflineQueue();
    }catch(e){
      // Offline or server error — queue the result locally
      this.queueOfflineResult(payload);
    }
  }
  queueOfflineResult(payload){
    try{
      const queue = JSON.parse(localStorage.getItem('velocis_offline_queue') || '[]');
      queue.push({...payload, queuedAt: new Date().toISOString()});
      localStorage.setItem('velocis_offline_queue', JSON.stringify(queue));
      console.log('[Offline] Result queued. Queue size:', queue.length);
      // Show toast
      const t=document.getElementById('toast'),m=document.getElementById('toast-msg');
      if(t&&m){m.textContent='📡 You\'re offline. Result saved locally and will sync when connected.';t.classList.remove('hidden');setTimeout(()=>t.classList.add('hidden'),4000);}
    }catch(e){}
  }
  async syncOfflineQueue(){
    try{
      const queue = JSON.parse(localStorage.getItem('velocis_offline_queue') || '[]');
      if(!queue.length) return;
      let synced = 0;
      for(let i = 0; i < queue.length; i++){
        try{
          const r = await fetch('/api/results',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(queue[i])});
          if(r.ok) synced++;
          else break; // still failing, stop trying
        }catch(e){ break; }
      }
      if(synced > 0){
        const remaining = queue.slice(synced);
        localStorage.setItem('velocis_offline_queue', JSON.stringify(remaining));
        console.log(`[Offline] Synced ${synced} results. Remaining: ${remaining.length}`);
        const t=document.getElementById('toast'),m=document.getElementById('toast-msg');
        if(t&&m){m.textContent=`✅ ${synced} offline result${synced>1?'s':''} synced to server!`;t.classList.remove('hidden');setTimeout(()=>t.classList.add('hidden'),4000);}
      }
    }catch(e){}
  }
  // Export stats as PDF
  exportStatsPDF(){
    const t = this.stats.tests;
    const bestWpm = t.length ? Math.max(...t.map(x=>x.wpm||0)) : 0;
    const avgWpm = t.length ? Math.round(t.reduce((a,x)=>a+(x.wpm||0),0)/t.length) : 0;
    const avgAcc = t.length ? Math.round(t.reduce((a,x)=>a+(x.accuracy||0),0)/t.length) : 0;
    const totalTests = t.length;
    const totalTime = Math.round(this.stats.totalTime/60);
    const totalChars = this.stats.totalChars;
    const userName = (this.auth && this.auth.user) ? (this.auth.user.displayName || this.auth.user.username) : 'User';
    const now = new Date().toLocaleDateString('en-US', {year:'numeric',month:'long',day:'numeric'});

    const recentTests = t.slice(-10).reverse().map(test => {
      const d = new Date(test.date);
      return `<tr><td>${test.wpm||0}</td><td>${test.accuracy||0}%</td><td>${test.errors||0}</td><td>${test.difficulty||'test'}</td><td>${d.toLocaleDateString()}</td></tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><title>Velocis Typing — Stats Report</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Segoe UI',system-ui,sans-serif;background:#0a0a1a;color:#fff;padding:40px}
      .report{max-width:800px;margin:0 auto;background:#111;border-radius:16px;padding:40px;border:1px solid #222}
      h1{font-size:28px;margin-bottom:4px;background:linear-gradient(135deg,#0071e3,#00d4ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
      .subtitle{color:#888;font-size:14px;margin-bottom:32px}
      .stats-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:32px}
      .stat-box{background:#1a1a2e;border-radius:12px;padding:20px;text-align:center;border:1px solid #333}
      .stat-val{font-size:36px;font-weight:800;color:#00d4ff}
      .stat-lbl{font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-top:4px}
      h2{font-size:18px;margin-bottom:12px;color:#ccc}
      table{width:100%;border-collapse:collapse;margin-bottom:24px}
      th{text-align:left;padding:10px 12px;border-bottom:2px solid #333;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px}
      td{padding:10px 12px;border-bottom:1px solid #222;font-size:14px}
      .footer{text-align:center;color:#555;font-size:12px;margin-top:24px;padding-top:16px;border-top:1px solid #222}
      @media print{body{background:#fff;color:#000;padding:20px}.report{background:#fff;border:none;box-shadow:none}.stat-box{background:#f5f5f5;border:1px solid #ddd}.stat-val{color:#0071e3}th{color:#666;border-bottom-color:#ddd}td{border-bottom-color:#eee}.footer{color:#aaa}h1{-webkit-text-fill-color:#0071e3}}
    </style></head><body>
    <div class="report">
      <h1 style="display:flex;align-items:center;gap:12px;"><img src="./icons/icon-192x192.png" alt="Velocis Logo" style="width:36px;height:36px;object-fit:contain;border-radius:8px;"> Velocis Typing — Performance Report</h1>
      <p class="subtitle">Report for ${userName} • Generated on ${now}</p>
      <div class="stats-grid">
        <div class="stat-box"><div class="stat-val">${bestWpm}</div><div class="stat-lbl">Best WPM</div></div>
        <div class="stat-box"><div class="stat-val">${avgWpm}</div><div class="stat-lbl">Average WPM</div></div>
        <div class="stat-box"><div class="stat-val">${avgAcc}%</div><div class="stat-lbl">Avg Accuracy</div></div>
        <div class="stat-box"><div class="stat-val">${totalTests}</div><div class="stat-lbl">Tests Taken</div></div>
        <div class="stat-box"><div class="stat-val">${totalTime}m</div><div class="stat-lbl">Total Practice</div></div>
        <div class="stat-box"><div class="stat-val">${totalChars.toLocaleString()}</div><div class="stat-lbl">Characters Typed</div></div>
      </div>
      <h2>Recent Tests</h2>
      <table><thead><tr><th>WPM</th><th>Accuracy</th><th>Errors</th><th>Mode</th><th>Date</th></tr></thead>
      <tbody>${recentTests || '<tr><td colspan="5" style="text-align:center;color:#888">No tests yet</td></tr>'}</tbody></table>
      <div class="footer">Velocis Typing © ${new Date().getFullYear()} — velocistyping.com</div>
    </div>
    <script>window.onload=()=>window.print();<\/script>
    </body></html>`;

    const win = window.open('','_blank');
    win.document.write(html);
    win.document.close();
  }
  async saveLessonToServer(lessonId,wpm,acc){
    if(!this.auth||!this.auth.isLoggedIn())return;
    try{await fetch('/api/lessons/'+lessonId+'/complete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({wpm,accuracy:acc})});}catch(e){}
  }
  async loadFromServer(){
    if(!this.auth||!this.auth.isLoggedIn())return;
    // Sync offline queue first
    this.syncOfflineQueue();
    try{
      const r=await fetch('/api/stats');const d=await r.json();
      this.stats.lessonsCompleted=d.lessonsCompleted||[];
      this.stats.totalChars=d.totalChars||0;this.stats.totalTime=d.totalTime||0;
      const r2=await fetch('/api/results');const d2=await r2.json();
      this.stats.tests=(d2.results||[]).map(t=>({wpm:t.wpm,raw:t.raw_wpm,accuracy:t.accuracy,errors:t.errors,chars:t.chars_typed,duration:t.duration,date:t.created_at,difficulty:t.difficulty}));
      this.saveData('tm_stats',this.stats);this.renderHome();this.renderLessons();
    }catch(e){}
  }
}
document.addEventListener('DOMContentLoaded',()=>{
  const app=new TypingApp();
  app.auth=new Auth(app);
  // Patch showResults to also save to server
  const origShow=app.showResults.bind(app);
  app.showResults=function(){
    origShow();
    const t=this.stats.tests[this.stats.tests.length-1];
    if(t)this.saveResultToServer(t.wpm,t.raw,t.accuracy,t.errors,t.chars,t.duration,t.difficulty,'test');
  };
  // Patch completeSession to also save to server
  const origComplete=app.completeSession.bind(app);
  app.completeSession=function(mode){
    origComplete(mode);
    if(mode==='lesson'&&this.activeLessonId){
      const cc=this.typedChars.filter(c=>c.correct).length;
      const elapsed=(Date.now()-this.startTime)/60000;
      this.saveLessonToServer(this.activeLessonId,Math.round((cc/5)/elapsed),Math.round((cc/this.typedChars.length)*100));
    }
    if(mode==='practice'){
      const t=this.stats.tests[this.stats.tests.length-1];
      if(t)this.saveResultToServer(t.wpm,t.wpm,t.accuracy,t.errors,t.chars,t.duration,'practice','practice');
    }
  };
});

