const urlParams = new URLSearchParams(window.location.search);
        const isOBSMode = urlParams.get('mode') === 'obs';
        const syncChannel = new BroadcastChannel('cricket_broadcast_sync');

        let isBoardVisible = true;
        let activeOverlay = null;

        function resizePreview() {
            if(isOBSMode) return;
            const box = document.getElementById('preview-box');
            const inner = document.getElementById('preview-inner');
            if(box && inner) {
                const scale = box.clientWidth / 1920;
                inner.style.transform = `scale(${scale})`;
            }
        }

        if(isOBSMode) {
            document.body.classList.add('obs-mode');
            document.body.appendChild(document.getElementById('preview-inner'));
            
            syncChannel.onmessage = (e) => {
                const data = e.data;
                if(data.type === 'stateUpdate') { matchState = data.state; isBoardVisible = data.isBoardVisible; activeOverlay = data.activeOverlay; updateUI(true); } 
                else if(data.type === 'anim') triggerAnim(data.animType, true);
                else if(data.type === 'special_anim') triggerSpecialAnim(data.animType, true);
                else if(data.type === 'overlay') executeOverlay(data.overlayType, true);
                else if(data.type === 'styles') applyStylesFromSync(data.cssVars);
                else if(data.type === 'tickerStyles') applyTickerFromSync(data.vars);
                else if(data.type === 'milestone') executeMilestone(data.title, data.name, data.stats, true);
                else if(data.type === 'hide_milestone') hideMilestone(true);
                else if(data.type === 'lthird') executeLThird(data.title, data.name, data.role, true);
                else if(data.type === 'hide_lthird') hideLThird(true);
                else if(data.type === 'sponsor') applySponsor(data.imgSrc);
            };
        } else {
            window.addEventListener('resize', resizePreview);
            setTimeout(resizePreview, 100);
        }

        function pushSyncUpdate() { 
            try {
                if(!isOBSMode) syncChannel.postMessage({ type: 'stateUpdate', state: matchState, isBoardVisible: isBoardVisible, activeOverlay: activeOverlay }); 
            } catch(e) {}
        }
        function launchOBSWindow() { window.open(window.location.href.split('?')[0] + '?mode=obs', 'OBS Output', 'width=1920,height=1080,menubar=no,toolbar=no,location=no,status=no'); }

        let defaultPlayers1 = Array.from({length: 11}, (_, i) => ({name: `T1 P${i+1}`, role: "Player", runs: 0, balls: 0, status: "Yet to Bat"}));
        let defaultPlayers2 = Array.from({length: 11}, (_, i) => ({name: `T2 P${i+1}`, role: "Player", runs: 0, balls: 0, status: "Yet to Bat"}));

        let matchState = {
            isStarted: false, innings: 1, runs: 0, wickets: 0, balls: 0, target: 0, totalOvers: 20, extras: 0,
            team1: { name: "TEAM A", shortName: "TEA", players: defaultPlayers1, bowlers: {}, logo: "" }, 
            team2: { name: "TEAM B", shortName: "TEB", players: defaultPlayers2, bowlers: {}, logo: "" },
            battingTeam: 1, crease: [0, 1], strikerPos: 0, nextBatterIdx: 2, bowlerName: "", thisOver: [], currentOverRuns: 0, lastWicket: null,
            toss: { text: "" }, matchTitle: "",
            toggles: { title: true, tgt: false, crr: true, rrr: false, eq: true, toss: true, part: true, fow: true, ticker: false },
            partnership: { runs: 0, balls: 0 }, lastFowText: "", matchResultText: "", showMatchResult: false, sponsorSrc: "",
            styles: { 
                yPos: 650, gapPos: 50, sumY: 300, fowY: 700, mStoneY: 800, ybatY: 300, 
                bg1: "#ffffff", bg2: "#f0f2f5", sc1: "#0d1266", sc2: "#1a237e", colInd: "#00e676", 
                ctrlZoom: 1, rightColWidth: 42, previewWidth: 100,
                scaleX: 1, scaleY: 1, scaleFow: 0.9, scaleBat: 0.9, scaleBowl: 0.9, scaleYtb: 0.9, scaleMile: 1, scaleLthird: 1,
                szTeam: 16, szTotal: 30, szBName: 16, szBRuns: 18, szBBalls: 12, szStats: 12, szInfo: 10, szBowler: 16,
                cTeam: "#7f8c8d", cTotal: "#ffffff", cBName: "#2c3e50", cBRuns: "#1a237e", cBBalls: "#7f8c8d", cStats: "#2c3e50", cInfo: "#2c3e50", cBowler: "#2c3e50",
                chromaCtrl: "#050505", chromaObs: "#00FF00"
            },
            ticker: { text: "WELCOME TO THE MATCH", speed: 20, opacity: 100, size: 24, font: "'Segoe UI', sans-serif", bg1: "#1a237e", bg2: "#0d1266", c1: "#ffffff", c2: "#ffffff", xPos: 0, yPos: 1020, w: 1920, h: 60, rad: 0 },
            shortcuts: {
                run0: '0', run1: '1', run2: '2', run3: '3', run4: '4', run6: '6', wd: 'w', nb: 'n', b: 'b', lb: 'l', out: 'o', undo: 'u', trigFreeHit: '', trigHatTrick: '', animFour: '', animSix: '', animOut: '',
                togMain: 'm', togFow: 'f', togBat: 't', togBowl: 'y', togYtb: 'i', hideAll: 'h', showMile: 'p', hideMile: '[', ltBatter: '', ltBowler: '', hideLt: '',
                togTitle: '', togTicker: '', togTgt: 'z', togCrr: 'x', togRrr: 'c', togEq: 'v', togToss: 'a', togPart: 's', togFowGraphic: 'd'
            }
        };
        let history = [];

        function loadFromMemory() {
            if(isOBSMode) return;
            const saved = localStorage.getItem('cricketMatchState');
            if(saved) {
                const parsed = JSON.parse(saved);
                matchState = { ...matchState, ...parsed }; 
                
                const safeSetVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val; };
                const safeCheck = (id, val) => { const el = document.getElementById(id); if(el) el.checked = val; };
                const safeSetNum = (id, val) => { const el = document.getElementById(id); if(el && val !== undefined) el.value = parseFloat(val); };
                const safeSetCol = (id, val) => { const el = document.getElementById(id); if(el && val) el.value = val; };

                safeSetVal('match-title-input', matchState.matchTitle || "LPL 2026 - FINAL");

                if(matchState.team1.players && matchState.team1.players.length > 0) {
                    safeSetVal('t1-name', matchState.team1.name); safeSetVal('t2-name', matchState.team2.name);
                    safeSetVal('t1-short', matchState.team1.shortName); safeSetVal('t2-short', matchState.team2.shortName);
                    
                    const s1 = document.getElementById('t1-roster-status'); if(s1) s1.innerText = "Memory loaded roster.";
                    const s2 = document.getElementById('t2-roster-status'); if(s2) s2.innerText = "Memory loaded roster.";

                    populateBowlers(); populateMilestonePlayers();
                    if(matchState.isStarted) document.querySelectorAll('#scoring-controls button').forEach(b => b.disabled = false);
                }

                if(matchState.toggles) {
                    safeCheck('tog-title', matchState.toggles.title); safeCheck('tog-tgt', matchState.toggles.tgt); 
                    safeCheck('tog-crr', matchState.toggles.crr); safeCheck('tog-rrr', matchState.toggles.rrr); 
                    safeCheck('tog-eq', matchState.toggles.eq); safeCheck('tog-toss', matchState.toggles.toss); 
                    safeCheck('tog-part', matchState.toggles.part); safeCheck('tog-fow', matchState.toggles.fow);
                    safeCheck('tog-ticker', matchState.toggles.ticker);
                }

                if(matchState.styles) {
                    safeSetCol('bg1', matchState.styles.bg1); safeSetCol('bg2', matchState.styles.bg2);
                    safeSetCol('sc1', matchState.styles.sc1); safeSetCol('sc2', matchState.styles.sc2);
                    safeSetCol('col-ind', matchState.styles.colInd);
                    
                    safeSetCol('c-team', matchState.styles.cTeam); safeSetCol('c-total', matchState.styles.cTotal);
                    safeSetCol('c-b-name', matchState.styles.cBName); safeSetCol('c-b-runs', matchState.styles.cBRuns);
                    safeSetCol('c-b-balls', matchState.styles.cBBalls); safeSetCol('c-stats', matchState.styles.cStats);
                    safeSetCol('c-info', matchState.styles.cInfo); safeSetCol('c-bowler', matchState.styles.cBowler);

                    safeSetCol('chroma-ctrl', matchState.styles.chromaCtrl); safeSetCol('chroma-obs', matchState.styles.chromaObs);

                    safeSetNum('y-pos', matchState.styles.yPos); safeSetNum('gap-pos', matchState.styles.gapPos);
                    safeSetNum('scale-x', matchState.styles.scaleX); safeSetNum('scale-y', matchState.styles.scaleY);
                    
                    safeSetNum('scale-fow', matchState.styles.scaleFow); safeSetNum('scale-bat', matchState.styles.scaleBat);
                    safeSetNum('scale-bowl', matchState.styles.scaleBowl); safeSetNum('scale-ytb', matchState.styles.scaleYtb);
                    safeSetNum('scale-mile', matchState.styles.scaleMile); safeSetNum('scale-lthird', matchState.styles.scaleLthird);

                    safeSetNum('summary-y-pos', matchState.styles.sumY); safeSetNum('fow-y-pos', matchState.styles.fowY);
                    safeSetNum('milestone-y-pos', matchState.styles.mStoneY); safeSetNum('yettobat-y-pos', matchState.styles.ybatY);
                    
                    safeSetNum('sz-team', matchState.styles.szTeam); safeSetNum('sz-total', matchState.styles.szTotal);
                    safeSetNum('sz-b-name', matchState.styles.szBName); safeSetNum('sz-b-runs', matchState.styles.szBRuns);
                    safeSetNum('sz-b-balls', matchState.styles.szBBalls); safeSetNum('sz-stats', matchState.styles.szStats);
                    safeSetNum('sz-info', matchState.styles.szInfo); safeSetNum('sz-bowler', matchState.styles.szBowler);
                    
                    safeSetNum('ctrl-zoom', matchState.styles.ctrlZoom);
                    safeSetNum('right-col-width', matchState.styles.rightColWidth);
                    safeSetNum('preview-width', matchState.styles.previewWidth);
                }

                if(matchState.ticker) {
                    safeSetVal('tick-text', matchState.ticker.text); safeSetNum('tick-speed', matchState.ticker.speed);
                    safeSetNum('tick-opacity', matchState.ticker.opacity); safeSetNum('tick-size', matchState.ticker.size);
                    safeSetVal('tick-font', matchState.ticker.font); safeSetCol('tick-bg1', matchState.ticker.bg1);
                    safeSetCol('tick-bg2', matchState.ticker.bg2); safeSetCol('tick-c1', matchState.ticker.c1);
                    safeSetCol('tick-c2', matchState.ticker.c2); safeSetNum('tick-x', matchState.ticker.xPos);
                    safeSetNum('tick-y', matchState.ticker.yPos); safeSetNum('tick-w', matchState.ticker.w);
                    safeSetNum('tick-h', matchState.ticker.h); safeSetNum('tick-rad', matchState.ticker.rad);
                }

                if(matchState.shortcuts) {
                    Object.keys(matchState.shortcuts).forEach(key => { const el = document.getElementById(`key-${key}`); if(el) el.value = matchState.shortcuts[key]; });
                }

                if(matchState.sponsorSrc) applySponsor(matchState.sponsorSrc);
                updateUI(); updateCheatSheet();
            }
        }

        function saveHistory() { history.push(JSON.stringify(matchState)); if(!isOBSMode) localStorage.setItem('cricketMatchState', JSON.stringify(matchState)); }

        function updStyle() {
            matchState.styles = {
                bg1: document.getElementById('bg1')?.value || "#ffffff", bg2: document.getElementById('bg2')?.value || "#f0f2f5",
                sc1: document.getElementById('sc1')?.value || "#0d1266", sc2: document.getElementById('sc2')?.value || "#1a237e",
                colInd: document.getElementById('col-ind')?.value || "#00e676",
                
                yPos: parseInt(document.getElementById('y-pos')?.value || 650), gapPos: parseInt(document.getElementById('gap-pos')?.value || 50),
                scaleX: parseFloat(document.getElementById('scale-x')?.value || 1), scaleY: parseFloat(document.getElementById('scale-y')?.value || 1),
                
                scaleFow: parseFloat(document.getElementById('scale-fow')?.value || 0.9), scaleBat: parseFloat(document.getElementById('scale-bat')?.value || 0.9),
                scaleBowl: parseFloat(document.getElementById('scale-bowl')?.value || 0.9), scaleYtb: parseFloat(document.getElementById('scale-ytb')?.value || 0.9),
                scaleMile: parseFloat(document.getElementById('scale-mile')?.value || 1), scaleLthird: parseFloat(document.getElementById('scale-lthird')?.value || 1),
                
                sumY: parseInt(document.getElementById('summary-y-pos')?.value || 300), fowY: parseInt(document.getElementById('fow-y-pos')?.value || 700),
                mStoneY: parseInt(document.getElementById('milestone-y-pos')?.value || 800), ybatY: parseInt(document.getElementById('yettobat-y-pos')?.value || 300),
                
                ctrlZoom: parseFloat(document.getElementById('ctrl-zoom')?.value || 1),
                rightColWidth: parseInt(document.getElementById('right-col-width')?.value || 42),
                previewWidth: parseInt(document.getElementById('preview-width')?.value || 100),

                szTeam: parseInt(document.getElementById('sz-team')?.value || 16), szTotal: parseInt(document.getElementById('sz-total')?.value || 30),
                szBName: parseInt(document.getElementById('sz-b-name')?.value || 16), szBRuns: parseInt(document.getElementById('sz-b-runs')?.value || 18),
                szBBalls: parseInt(document.getElementById('sz-b-balls')?.value || 12), szStats: parseInt(document.getElementById('sz-stats')?.value || 12),
                szInfo: parseInt(document.getElementById('sz-info')?.value || 10), szBowler: parseInt(document.getElementById('sz-bowler')?.value || 16),
                
                cTeam: document.getElementById('c-team')?.value || "#7f8c8d", cTotal: document.getElementById('c-total')?.value || "#ffffff",
                cBName: document.getElementById('c-b-name')?.value || "#2c3e50", cBRuns: document.getElementById('c-b-runs')?.value || "#1a237e",
                cBBalls: document.getElementById('c-b-balls')?.value || "#7f8c8d", cStats: document.getElementById('c-stats')?.value || "#2c3e50",
                cInfo: document.getElementById('c-info')?.value || "#2c3e50", cBowler: document.getElementById('c-bowler')?.value || "#2c3e50",
                
                chromaCtrl: document.getElementById('chroma-ctrl')?.value || "#050505", chromaObs: document.getElementById('chroma-obs')?.value || "#00FF00"
            };
            applyStylesFromSync(matchState.styles);
            if(typeof resizePreview === 'function') resizePreview();
            if(!isOBSMode) { localStorage.setItem('cricketMatchState', JSON.stringify(matchState)); syncChannel.postMessage({ type: 'styles', cssVars: matchState.styles }); }
        }

        function applyStylesFromSync(vars) {
            const root = document.documentElement;
            if(vars.bg1) root.style.setProperty('--bg-grad-1', vars.bg1); if(vars.bg2) root.style.setProperty('--bg-grad-2', vars.bg2);
            if(vars.sc1) root.style.setProperty('--score-grad-1', vars.sc1); if(vars.sc2) root.style.setProperty('--score-grad-2', vars.sc2);
            if(vars.colInd) root.style.setProperty('--indicator-color', vars.colInd);
            
            if(vars.yPos !== undefined) root.style.setProperty('--board-offset-y', parseInt(vars.yPos) + 'px'); 
            if(vars.gapPos !== undefined) root.style.setProperty('--panels-gap', parseInt(vars.gapPos) + 'px');
            if(vars.scaleX !== undefined) root.style.setProperty('--scale-x', parseFloat(vars.scaleX)); 
            if(vars.scaleY !== undefined) root.style.setProperty('--scale-y', parseFloat(vars.scaleY)); 
            
            if(vars.scaleFow !== undefined) root.style.setProperty('--scale-fow', parseFloat(vars.scaleFow)); 
            if(vars.scaleBat !== undefined) root.style.setProperty('--scale-bat', parseFloat(vars.scaleBat)); 
            if(vars.scaleBowl !== undefined) root.style.setProperty('--scale-bowl', parseFloat(vars.scaleBowl)); 
            if(vars.scaleYtb !== undefined) root.style.setProperty('--scale-ytb', parseFloat(vars.scaleYtb)); 
            if(vars.scaleMile !== undefined) root.style.setProperty('--scale-mile', parseFloat(vars.scaleMile)); 
            if(vars.scaleLthird !== undefined) root.style.setProperty('--scale-lthird', parseFloat(vars.scaleLthird)); 
            
            if(vars.sumY !== undefined) root.style.setProperty('--summary-pos-y', parseInt(vars.sumY) + 'px'); 
            if(vars.fowY !== undefined) root.style.setProperty('--fow-pos-y', parseInt(vars.fowY) + 'px');
            if(vars.mStoneY !== undefined) { root.style.setProperty('--milestone-pos-y', parseInt(vars.mStoneY) + 'px'); root.style.setProperty('--lthird-pos-y', parseInt(vars.mStoneY) + 'px'); }
            if(vars.ybatY !== undefined) root.style.setProperty('--yettobat-pos-y', parseInt(vars.ybatY) + 'px');
            
            if(vars.szTeam !== undefined) root.style.setProperty('--sz-team', parseInt(vars.szTeam) + 'px'); 
            if(vars.szTotal !== undefined) root.style.setProperty('--sz-total', parseInt(vars.szTotal) + 'px'); 
            if(vars.szBName !== undefined) root.style.setProperty('--sz-batter-name', parseInt(vars.szBName) + 'px'); 
            if(vars.szBRuns !== undefined) root.style.setProperty('--sz-batter-runs', parseInt(vars.szBRuns) + 'px'); 
            if(vars.szBBalls !== undefined) root.style.setProperty('--sz-batter-balls', parseInt(vars.szBBalls) + 'px'); 
            if(vars.szStats !== undefined) root.style.setProperty('--sz-stats', parseInt(vars.szStats) + 'px'); 
            if(vars.szInfo !== undefined) root.style.setProperty('--sz-info', parseInt(vars.szInfo) + 'px'); 
            if(vars.szBowler !== undefined) root.style.setProperty('--sz-bowler', parseInt(vars.szBowler) + 'px'); 
            
            if(vars.cTeam) root.style.setProperty('--c-team', vars.cTeam);
            if(vars.cTotal) root.style.setProperty('--c-total', vars.cTotal);
            if(vars.cBName) root.style.setProperty('--c-batter-name', vars.cBName);
            if(vars.cBRuns) root.style.setProperty('--c-batter-runs', vars.cBRuns);
            if(vars.cBBalls) root.style.setProperty('--c-batter-balls', vars.cBBalls);
            if(vars.cStats) root.style.setProperty('--c-stats', vars.cStats);
            if(vars.cInfo) root.style.setProperty('--c-info', vars.cInfo);
            if(vars.cBowler) root.style.setProperty('--c-bowler', vars.cBowler);

            if(vars.ctrlZoom !== undefined && !isOBSMode) root.style.setProperty('--ctrl-zoom', parseFloat(vars.ctrlZoom));
            if(vars.rightColWidth !== undefined && !isOBSMode) root.style.setProperty('--right-col-width', parseInt(vars.rightColWidth) + '%');
            if(vars.previewWidth !== undefined && !isOBSMode) root.style.setProperty('--preview-width', parseInt(vars.previewWidth) + '%');
            
            if(isOBSMode && vars.chromaObs) { document.body.style.backgroundColor = vars.chromaObs; }
            else if(!isOBSMode && vars.chromaCtrl) { document.body.style.backgroundColor = vars.chromaCtrl; }
        }

        function updTicker() {
            matchState.ticker = {
                text: document.getElementById('tick-text')?.value || "", speed: parseInt(document.getElementById('tick-speed')?.value || 20), opacity: parseInt(document.getElementById('tick-opacity')?.value || 100),
                size: parseInt(document.getElementById('tick-size')?.value || 24), font: document.getElementById('tick-font')?.value || "'Segoe UI', sans-serif",
                bg1: document.getElementById('tick-bg1')?.value || "#1a237e", bg2: document.getElementById('tick-bg2')?.value || "#0d1266", c1: document.getElementById('tick-c1')?.value || "#ffffff", c2: document.getElementById('tick-c2')?.value || "#ffffff",
                xPos: parseInt(document.getElementById('tick-x')?.value || 0), yPos: parseInt(document.getElementById('tick-y')?.value || 1020),
                w: parseInt(document.getElementById('tick-w')?.value || 1920), h: parseInt(document.getElementById('tick-h')?.value || 60), rad: parseInt(document.getElementById('tick-rad')?.value || 0)
            };
            applyTickerFromSync(matchState.ticker); updateUI(); 
            if(!isOBSMode) { localStorage.setItem('cricketMatchState', JSON.stringify(matchState)); syncChannel.postMessage({ type: 'tickerStyles', vars: matchState.ticker }); }
        }

        function applyTickerFromSync(vars) {
            const root = document.documentElement;
            if(vars.speed) root.style.setProperty('--tick-speed', vars.speed + 's'); if(vars.opacity) root.style.setProperty('--tick-opacity', vars.opacity / 100);
            if(vars.size) root.style.setProperty('--tick-size', vars.size + 'px'); if(vars.font) root.style.setProperty('--tick-font', vars.font);
            if(vars.bg1) root.style.setProperty('--tick-bg1', vars.bg1); if(vars.bg2) root.style.setProperty('--tick-bg2', vars.bg2);
            if(vars.c1) root.style.setProperty('--tick-c1', vars.c1); if(vars.c2) root.style.setProperty('--tick-c2', vars.c2);
            if(vars.xPos !== undefined) root.style.setProperty('--tick-x', vars.xPos + 'px'); if(vars.yPos !== undefined) root.style.setProperty('--tick-y', vars.yPos + 'px');
            if(vars.w !== undefined) root.style.setProperty('--tick-w', vars.w + 'px'); if(vars.h !== undefined) root.style.setProperty('--tick-h', vars.h + 'px');
            if(vars.rad !== undefined) root.style.setProperty('--tick-rad', vars.rad + 'px');
        }

        function exportPreset() {
            const preset = { styles: matchState.styles, toggles: matchState.toggles, ticker: matchState.ticker };
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(preset));
            const a = document.createElement('a');
            a.setAttribute("href", dataStr);
            a.setAttribute("download", "scoreboard_preset.json");
            document.body.appendChild(a);
            a.click();
            a.remove();
        }

        function importPreset(event) {
            const file = event.target.files[0];
            if(!file) return;
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const preset = JSON.parse(e.target.result);
                    if(preset.styles) matchState.styles = { ...matchState.styles, ...preset.styles };
                    if(preset.toggles) matchState.toggles = { ...matchState.toggles, ...preset.toggles };
                    if(preset.ticker) matchState.ticker = { ...matchState.ticker, ...preset.ticker };
                    
                    const safeCheck = (id, val) => { const el = document.getElementById(id); if(el) el.checked = val; };
                    const safeSetNum = (id, val) => { const el = document.getElementById(id); if(el && val !== undefined) el.value = parseFloat(val); };
                    const safeSetCol = (id, val) => { const el = document.getElementById(id); if(el && val) el.value = val; };
                    const safeSetVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val; };

                    safeCheck('tog-title', matchState.toggles.title); safeCheck('tog-tgt', matchState.toggles.tgt); 
                    safeCheck('tog-crr', matchState.toggles.crr); safeCheck('tog-rrr', matchState.toggles.rrr); 
                    safeCheck('tog-eq', matchState.toggles.eq); safeCheck('tog-toss', matchState.toggles.toss); 
                    safeCheck('tog-part', matchState.toggles.part); safeCheck('tog-fow', matchState.toggles.fow);
                    safeCheck('tog-ticker', matchState.toggles.ticker);

                    safeSetCol('bg1', matchState.styles.bg1); safeSetCol('bg2', matchState.styles.bg2);
                    safeSetCol('sc1', matchState.styles.sc1); safeSetCol('sc2', matchState.styles.sc2);
                    safeSetCol('col-ind', matchState.styles.colInd);
                    
                    safeSetCol('c-team', matchState.styles.cTeam); safeSetCol('c-total', matchState.styles.cTotal);
                    safeSetCol('c-b-name', matchState.styles.cBName); safeSetCol('c-b-runs', matchState.styles.cBRuns);
                    safeSetCol('c-b-balls', matchState.styles.cBBalls); safeSetCol('c-stats', matchState.styles.cStats);
                    safeSetCol('c-info', matchState.styles.cInfo); safeSetCol('c-bowler', matchState.styles.cBowler);

                    safeSetCol('chroma-ctrl', matchState.styles.chromaCtrl); safeSetCol('chroma-obs', matchState.styles.chromaObs);

                    safeSetNum('y-pos', matchState.styles.yPos); safeSetNum('gap-pos', matchState.styles.gapPos);
                    safeSetNum('scale-x', matchState.styles.scaleX); safeSetNum('scale-y', matchState.styles.scaleY);
                    
                    safeSetNum('scale-fow', matchState.styles.scaleFow); safeSetNum('scale-bat', matchState.styles.scaleBat);
                    safeSetNum('scale-bowl', matchState.styles.scaleBowl); safeSetNum('scale-ytb', matchState.styles.scaleYtb);
                    safeSetNum('scale-mile', matchState.styles.scaleMile); safeSetNum('scale-lthird', matchState.styles.scaleLthird);

                    safeSetNum('summary-y-pos', matchState.styles.sumY); safeSetNum('fow-y-pos', matchState.styles.fowY);
                    safeSetNum('milestone-y-pos', matchState.styles.mStoneY); safeSetNum('yettobat-y-pos', matchState.styles.ybatY);
                    
                    safeSetNum('sz-team', matchState.styles.szTeam); safeSetNum('sz-total', matchState.styles.szTotal);
                    safeSetNum('sz-b-name', matchState.styles.szBName); safeSetNum('sz-b-runs', matchState.styles.szBRuns);
                    safeSetNum('sz-b-balls', matchState.styles.szBBalls); safeSetNum('sz-stats', matchState.styles.szStats);
                    safeSetNum('sz-info', matchState.styles.szInfo); safeSetNum('sz-bowler', matchState.styles.szBowler);
                    
                    safeSetNum('ctrl-zoom', matchState.styles.ctrlZoom);
                    safeSetNum('right-col-width', matchState.styles.rightColWidth);
                    safeSetNum('preview-width', matchState.styles.previewWidth);

                    if(preset.ticker) {
                        safeSetVal('tick-text', matchState.ticker.text); safeSetNum('tick-speed', matchState.ticker.speed);
                        safeSetNum('tick-opacity', matchState.ticker.opacity); safeSetNum('tick-size', matchState.ticker.size);
                        safeSetVal('tick-font', matchState.ticker.font); safeSetCol('tick-bg1', matchState.ticker.bg1);
                        safeSetCol('tick-bg2', matchState.ticker.bg2); safeSetCol('tick-c1', matchState.ticker.c1);
                        safeSetCol('tick-c2', matchState.ticker.c2); safeSetNum('tick-x', matchState.ticker.xPos);
                        safeSetNum('tick-y', matchState.ticker.yPos); safeSetNum('tick-w', matchState.ticker.w);
                        safeSetNum('tick-h', matchState.ticker.h); safeSetNum('tick-rad', matchState.ticker.rad);
                        updTicker();
                    }

                    saveHistory(); updStyle(); updateUI();
                    alert("Preset loaded successfully!");
                } catch(err) {
                    alert("Invalid Preset File");
                }
            };
            reader.readAsText(file);
        }

        function updateTextWithAnim(id, value) {
            const el = document.getElementById(id);
            if (el && el.innerText !== String(value)) { el.innerText = value; el.classList.remove('pop-animate'); void el.offsetWidth; el.classList.add('pop-animate'); }
        }

        function updateCheatSheet() {
            if(isOBSMode) return;
            const s = matchState.shortcuts; const formatKey = (key, label) => key ? `<span class="cheat-key">${key.toUpperCase()}</span> ${label}` : '';
            
            document.getElementById('cheat-scoring').innerHTML = [
                formatKey(s.run0, '0'), formatKey(s.run1, '1'), formatKey(s.run2, '2'), formatKey(s.run3, '3'), formatKey(s.run4, '4'), formatKey(s.run6, '6'), formatKey(s.wd, 'Wide'), formatKey(s.nb, 'NB'), formatKey(s.b, 'Byes'), formatKey(s.lb, 'LB'), formatKey(s.out, 'OUT'), formatKey(s.undo, 'Undo')
            ].filter(Boolean).join(' &nbsp;|&nbsp; ');

            document.getElementById('cheat-overlays').innerHTML = [
                formatKey(s.togMain, 'Main Board'), formatKey(s.togFow, 'FOW View'), formatKey(s.togBat, 'Batting'), formatKey(s.togBowl, 'Bowling'), formatKey(s.togYtb, 'Yet to Bat'), formatKey(s.hideAll, 'Hide All'), formatKey(s.showMile, 'Milestone'), formatKey(s.ltBatter, 'New Batter'), formatKey(s.ltBowler, 'New Bowler'), formatKey(s.hideLt, 'Hide L.Thirds')
            ].filter(Boolean).join(' &nbsp;|&nbsp; ');

            document.getElementById('cheat-toggles').innerHTML = [
                formatKey(s.togTitle, 'Title'), formatKey(s.togTicker, 'Ticker'), formatKey(s.togTgt, 'Target'), formatKey(s.togCrr, 'CRR'), formatKey(s.togRrr, 'RRR'), formatKey(s.togEq, 'Win Eq'), formatKey(s.togToss, 'Toss'), formatKey(s.togPart, 'Partnership'), formatKey(s.togFowGraphic, 'Last FOW')
            ].filter(Boolean).join(' &nbsp;|&nbsp; ');
        }

        function uploadTeamLogo(event, teamNum) {
            const file = event.target.files[0];
            if(file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const img = new Image();
                    img.onload = function() {
                        const canvas = document.createElement('canvas'); const MAX = 150; let w = img.width; let h = img.height;
                        if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX; } } else { if (h > MAX) { w *= MAX / h; h = MAX; } }
                        canvas.width = w; canvas.height = h; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);
                        const compressed = canvas.toDataURL('image/png');
                        if (teamNum === 1) matchState.team1.logo = compressed; else matchState.team2.logo = compressed;
                        saveHistory(); updateUI();
                    }
                    img.src = e.target.result;
                }; reader.readAsDataURL(file);
            }
        }

        function uploadRoster(event, teamNum) {
            const file = event.target.files[0]; if(!file) return;
            const reader = new FileReader();
            reader.onload = function(e) {
                const lines = e.target.result.split(/\r?\n/); let players = [];
                lines.forEach(line => {
                    if(line.trim() === "") return;
                    const match = line.match(/^\d+\.\s*(.+?)\s*-\s*(.+)$/);
                    if(match) { players.push({ name: match[1].trim(), role: match[2].trim(), runs: 0, balls: 0, status: "Yet to Bat" }); } 
                    else { players.push({ name: line.replace(/^\d+\.\s*/, '').trim(), role: "Player", runs: 0, balls: 0, status: "Yet to Bat" }); }
                });
                while(players.length < 11) players.push({name: `Player ${players.length+1}`, role: "Player", runs: 0, balls: 0, status: "Yet to Bat"});
                players = players.slice(0, 11);
                if(teamNum === 1) matchState.team1.players = players; else matchState.team2.players = players;
                document.getElementById(`t${teamNum}-roster-status`).innerText = `Loaded ${players.length} players from file.`;
                saveHistory(); updateUI();
            }; reader.readAsText(file);
        }

        function uploadSponsor(event) {
            const file = event.target.files[0];
            if(file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    matchState.sponsorSrc = e.target.result; applySponsor(matchState.sponsorSrc);
                    if(!isOBSMode) syncChannel.postMessage({ type: 'sponsor', imgSrc: matchState.sponsorSrc });
                    saveHistory();
                };
                reader.readAsDataURL(file);
            }
        }
        function applySponsor(src) {
            const box = document.getElementById('sponsor-box');
            if(src && box) { document.getElementById('sponsor-img').src = src; box.style.display = 'flex'; } else if(box) box.style.display = 'none';
        }

        function toggleOverlay(type) { executeOverlay(type, false); }
        function executeOverlay(type, fromSync) {
            if(!isOBSMode && !fromSync) syncChannel.postMessage({ type: 'overlay', overlayType: type });
            
            if(type === 'main') { 
                isBoardVisible = !isBoardVisible; 
                updateUI();
                if(!isOBSMode) pushSyncUpdate(); 
                return; 
            }
            if(type === 'hide_all') { activeOverlay = null; hideAllOverlays(); updateUI(); return; }
            
            hideAllOverlays();
            activeOverlay = type;
            
            if(type === 'fow' && matchState.lastWicket) {
                document.getElementById('fow-name').innerText = matchState.lastWicket.name; document.getElementById('fow-runs').innerText = matchState.lastWicket.runs; document.getElementById('fow-balls').innerText = matchState.lastWicket.balls;
                const sr = matchState.lastWicket.balls > 0 ? ((matchState.lastWicket.runs / matchState.lastWicket.balls) * 100).toFixed(1) : "0.0"; document.getElementById('fow-sr').innerText = sr;
            } else if (type === 'batting') generateBattingSummary(); else if (type === 'bowling') generateBowlingSummary(); else if (type === 'yettobat') generateYetToBat();
              
            const ov = document.getElementById(`overlay-${type}`);
            if(ov) {
                ov.classList.remove('hide');
                setTimeout(()=> ov.classList.add('show'), 10);
            }
            updateUI();
        }
        
        function hideAllOverlays() {
            ['fow', 'batting', 'bowling', 'yettobat', 'milestone', 'lthird'].forEach(id => { let el = document.getElementById(`overlay-${id}`); if(el) { el.classList.remove('show'); el.classList.add('hide'); } });
            activeOverlay = null;
            updateUI();
        }

        function exportPDF() {
            if(!matchState.isStarted) { alert("Start a game first to export data!"); return; }
            const batT1 = matchState.battingTeam === 1 ? matchState.team1 : matchState.team2;
            const bowlT1 = matchState.battingTeam === 1 ? matchState.team2 : matchState.team1;

            let html = `<html><head><title>${matchState.matchTitle || "Match Scorecard"}</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #333; }
                h1 { text-align: center; color: #1a237e; text-transform: uppercase; margin-bottom: 5px; }
                h3 { text-align: center; color: #ff9800; margin-top: 0; }
                h4 { text-align: center; color: #555; }
                h2 { color: #1a237e; border-bottom: 2px solid #eee; padding-bottom: 5px; margin-top: 30px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px; }
                th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                th { background-color: #f4f7f6; color: #1a237e; text-transform: uppercase; }
                .bold { font-weight: bold; }
                .center { text-align: center; }
            </style></head><body>`;
            
            html += `<h1>${matchState.matchTitle || "Match Scorecard"}</h1>`;
            html += `<h3>${matchState.team1.name} vs ${matchState.team2.name}</h3>`;
            if(matchState.toss.text) html += `<h4>${matchState.toss.text}</h4>`;
            if(matchState.matchResultText) html += `<h3 style="color:#d32f2f; margin-top:20px;">${matchState.matchResultText}</h3>`;

            html += `<h2>Innings 1: ${batT1.name}</h2>`;
            html += `<table><tr><th>Batter</th><th>Status</th><th class="center">R</th><th class="center">B</th><th class="center">SR</th></tr>`;
            batT1.players.forEach(p => {
                if(p.balls > 0 || p.status !== "Yet to Bat") {
                    let sr = p.balls > 0 ? ((p.runs / p.balls) * 100).toFixed(1) : "0.0";
                    html += `<tr><td class="bold">${p.name}</td><td>${p.status}</td><td class="center">${p.runs}</td><td class="center">${p.balls}</td><td class="center">${sr}</td></tr>`;
                }
            });
            html += `</table>`;

            html += `<table><tr><th>Bowler</th><th class="center">O</th><th class="center">M</th><th class="center">R</th><th class="center">W</th></tr>`;
            for (let name in bowlT1.bowlers) {
                let b = bowlT1.bowlers[name];
                if(b.balls > 0) {
                    let overs = Math.floor(b.balls/6) + "." + (b.balls%6);
                    html += `<tr><td class="bold">${name}</td><td class="center">${overs}</td><td class="center">${b.maidens}</td><td class="center">${b.runs}</td><td class="center">${b.wickets}</td></tr>`;
                }
            }
            html += `</table>`;

            if(matchState.innings === 2) {
                const batT2 = matchState.battingTeam === 1 ? matchState.team2 : matchState.team1;
                const bowlT2 = matchState.battingTeam === 1 ? matchState.team1 : matchState.team2;

                html += `<h2>Innings 2: ${batT2.name}</h2>`;
                html += `<table><tr><th>Batter</th><th>Status</th><th class="center">R</th><th class="center">B</th><th class="center">SR</th></tr>`;
                batT2.players.forEach(p => {
                    if(p.balls > 0 || p.status !== "Yet to Bat") {
                        let sr = p.balls > 0 ? ((p.runs / p.balls) * 100).toFixed(1) : "0.0";
                        html += `<tr><td class="bold">${p.name}</td><td>${p.status}</td><td class="center">${p.runs}</td><td class="center">${p.balls}</td><td class="center">${sr}</td></tr>`;
                    }
                });
                html += `</table>`;

                html += `<table><tr><th>Bowler</th><th class="center">O</th><th class="center">M</th><th class="center">R</th><th class="center">W</th></tr>`;
                for (let name in bowlT2.bowlers) {
                    let b = bowlT2.bowlers[name];
                    if(b.balls > 0) {
                        let overs = Math.floor(b.balls/6) + "." + (b.balls%6);
                        html += `<tr><td class="bold">${name}</td><td class="center">${overs}</td><td class="center">${b.maidens}</td><td class="center">${b.runs}</td><td class="center">${b.wickets}</td></tr>`;
                    }
                }
                html += `</table>`;
            }
            html += `</body></html>`;

            let printWindow = window.open('', '', 'width=800,height=900');
            printWindow.document.write(html);
            printWindow.document.close();
            setTimeout(() => { printWindow.print(); }, 500); 
        }

        function getActiveBattingTeam() { return matchState.battingTeam === 1 ? matchState.team1 : matchState.team2; }
        function getActiveBowlingTeam() { return matchState.battingTeam === 1 ? matchState.team2 : matchState.team1; }
        function getBowlerStats(name) { const bTeam = getActiveBowlingTeam(); if(!bTeam.bowlers[name]) bTeam.bowlers[name] = { balls: 0, runs: 0, wickets: 0, maidens: 0 }; return bTeam.bowlers[name]; }

        function generateBattingSummary() {
            let html = ''; const batTeam = getActiveBattingTeam();
            batTeam.players.forEach((p, idx) => {
                const isActive = matchState.isStarted && (matchState.crease[0] === idx || matchState.crease[1] === idx);
                let dispStatus = p.status; if(isActive) dispStatus = "Batting";

                if (p.status === "Yet to Bat" && !isActive) { html += `<tr><td class="bold">${p.name}</td><td>${p.role || 'Player'}</td><td>Yet to Bat</td><td>-</td><td>-</td><td>-</td></tr>`; } 
                else { let sr = p.balls > 0 ? ((p.runs / p.balls) * 100).toFixed(1) : "0.0"; html += `<tr><td class="bold">${p.name}</td><td>${p.role || 'Player'}</td><td>${dispStatus}</td><td>${p.runs}</td><td>${p.balls}</td><td>${sr}</td></tr>`; }
            }); document.getElementById('batting-tbody').innerHTML = html;
        }

        function generateBowlingSummary() {
            const bTeam = getActiveBowlingTeam(); let html = '';
            for (let name in bTeam.bowlers) {
                let stats = bTeam.bowlers[name];
                if(stats.balls > 0) { let overs = Math.floor(stats.balls/6) + "." + (stats.balls%6); html += `<tr><td class="bold">${name}</td><td>${overs}</td><td>${stats.maidens}</td><td>${stats.runs}</td><td>${stats.wickets}</td></tr>`; }
            } document.getElementById('bowling-tbody').innerHTML = html;
        }

        function generateYetToBat() {
            let html = ''; const team = getActiveBattingTeam();
            team.players.forEach((p, idx) => {
                if(p.status === "Yet to Bat" && matchState.crease[0] !== idx && matchState.crease[1] !== idx) { html += `<tr><td class="bold">${p.name}</td><td>${p.role || 'Player'}</td></tr>`; }
            }); document.getElementById('yettobat-tbody').innerHTML = html;
        }

        function triggerMilestone() {
            const pIdx = document.getElementById('milestone-player').value; const p = getActiveBattingTeam().players[pIdx]; if(!p) return;
            const title = document.getElementById('milestone-title-input').value; const stats = `${p.runs} RUNS (${p.balls} BALLS)`;
            executeMilestone(title, p.name, stats, false);
        }
        function executeMilestone(title, name, stats, fromSync) {
            hideAllOverlays();
            document.getElementById('milestone-title').innerText = title; document.getElementById('milestone-name').innerText = name; document.getElementById('milestone-stats').innerText = stats;
            const ov = document.getElementById('overlay-milestone'); ov.classList.remove('hide'); setTimeout(()=> ov.classList.add('show'), 10);
            activeOverlay = 'milestone'; updateUI();
            if(!isOBSMode && !fromSync) syncChannel.postMessage({ type: 'milestone', title, name, stats });
        }
        function hideMilestone(fromSync = false) {
            document.getElementById('overlay-milestone').classList.remove('show'); document.getElementById('overlay-lthird').classList.remove('show');
            activeOverlay = null; updateUI();
            if(!isOBSMode && !fromSync) syncChannel.postMessage({ type: 'hide_milestone' });
        }
        
        function triggerLThird(type) {
            const pIdx = document.getElementById(type === 'BATTER' ? 'lt-batter' : 'lt-bowler').value; 
            const team = type === 'BATTER' ? getActiveBattingTeam() : getActiveBowlingTeam();
            const p = team.players[pIdx]; if(!p) return;
            executeLThird(`NEW ${type}`, p.name, p.role || 'Player', false);
        }
        function executeLThird(title, name, role, fromSync) {
            hideAllOverlays();
            document.getElementById('lthird-title').innerText = title; document.getElementById('lthird-name').innerText = name; document.getElementById('lthird-role').innerText = role;
            const ov = document.getElementById('overlay-lthird'); ov.classList.remove('hide'); setTimeout(()=> ov.classList.add('show'), 10);
            activeOverlay = 'lthird'; updateUI();
            if(!isOBSMode && !fromSync) syncChannel.postMessage({ type: 'lthird', title, name, role });
        }
        function hideLThird(fromSync = false) { hideMilestone(fromSync); }

        function populateMilestonePlayers() {
            const selM = document.getElementById('milestone-player'); const selBat = document.getElementById('lt-batter'); const selBowl = document.getElementById('lt-bowler');
            if(selM) { selM.innerHTML = ''; getActiveBattingTeam().players.forEach((p, idx) => { if(p.runs > 0) selM.add(new Option(`${p.name} (${p.runs})`, idx)); }); }
            if(selBat) { selBat.innerHTML = ''; getActiveBattingTeam().players.forEach((p, idx) => { selBat.add(new Option(p.name, idx)); }); }
            if(selBowl) { selBowl.innerHTML = ''; getActiveBowlingTeam().players.forEach((p, idx) => { selBowl.add(new Option(p.name, idx)); }); }
        }

        function toggleMatchResult() { matchState.showMatchResult = !matchState.showMatchResult; matchState.matchResultText = document.getElementById('input-match-result').value || "MATCH ENDED"; saveHistory(); updateUI(); }

        function saveTeamInfo() {
            matchState.team1.name = document.getElementById('t1-name').value || "TEAM A"; matchState.team1.shortName = document.getElementById('t1-short').value || "TMA";
            matchState.team2.name = document.getElementById('t2-name').value || "TEAM B"; matchState.team2.shortName = document.getElementById('t2-short').value || "TMB"; 
            document.getElementById('toss-winner-select').options[0].text = matchState.team1.name; document.getElementById('toss-winner-select').options[1].text = matchState.team2.name;
            populateBowlers(); populateMilestonePlayers(); saveHistory(); alert("Team Data Saved!"); updateUI();
        }

        function setToss() {
            const wIdx = document.getElementById('toss-winner-select').value; const dec = document.getElementById('toss-decision-select').value;
            matchState.toss.text = `${wIdx === '1' ? matchState.team1.name : matchState.team2.name} WON TOSS AND ELECTED TO ${dec}`;
            saveHistory(); updateUI();
        }

        function startGame() {
            if(matchState.team1.players.length === 0) return;
            const wIdx = document.getElementById('toss-winner-select').value; const dec = document.getElementById('toss-decision-select').value;
            let firstBattingTeam = 1; if (wIdx === '1' && dec === 'BOWL') firstBattingTeam = 2; if (wIdx === '2' && dec === 'BAT') firstBattingTeam = 2; if (wIdx === '2' && dec === 'BOWL') firstBattingTeam = 1;
            saveHistory(); matchState.isStarted = true; matchState.innings = 1; matchState.battingTeam = firstBattingTeam;
            matchState.runs = 0; matchState.wickets = 0; matchState.balls = 0; matchState.target = 0; matchState.currentOverRuns = 0; matchState.extras = 0;
            matchState.crease = [0, 1]; matchState.strikerPos = 0; matchState.nextBatterIdx = 2; matchState.thisOver = [];
            matchState.partnership = {runs: 0, balls: 0}; matchState.lastFowText = "-"; matchState.showMatchResult = false;
            matchState.totalOvers = parseInt(document.getElementById('in-total-overs').value) || 20;
            document.querySelectorAll('#scoring-controls button').forEach(b => b.disabled = false); updateUI();
        }

        function switchInnings() {
            if(!matchState.isStarted) return;
            saveHistory(); matchState.target = matchState.runs + 1; matchState.innings = 2; matchState.battingTeam = matchState.battingTeam === 1 ? 2 : 1; 
            matchState.runs = 0; matchState.wickets = 0; matchState.balls = 0; matchState.thisOver = []; matchState.currentOverRuns = 0; matchState.extras = 0;
            matchState.crease = [0, 1]; matchState.strikerPos = 0; matchState.nextBatterIdx = 2; matchState.partnership = {runs: 0, balls: 0}; matchState.lastFowText = "-";
            populateBowlers(); populateMilestonePlayers(); updateUI();
        }

        function clearThisOver() { saveHistory(); matchState.thisOver = []; updateUI(); }
        function resetMatch() { if(confirm("WARNING: This will completely wipe memory. Continue?")) { localStorage.removeItem('cricketMatchState'); location.reload(); } }

        function populateBowlers() {
            const sel = document.getElementById('bowler-select'); if(!sel) return; sel.innerHTML = '<option value="">-- Select New Bowler --</option>';
            const fTeam = getActiveBowlingTeam().players;
            if(!fTeam.length) return; fTeam.forEach(p => sel.add(new Option(p.name, p.name))); matchState.bowlerName = ""; sel.classList.add('bowler-alert');
        }
        function updateBowler() { matchState.bowlerName = document.getElementById('bowler-select').value; document.getElementById('bowler-select').classList.remove('bowler-alert'); updateUI(); }

        function triggerAnim(type, fromSync = false) {
            if(!isOBSMode && !fromSync) syncChannel.postMessage({ type: 'anim', animType: type });
            const popup = document.getElementById('event-popup'); 
            popup.className = 'event-popup'; void popup.offsetWidth; 
            popup.className = `event-popup show bg-${type.toLowerCase().replace(/\s+/g, '')}`; 
            document.getElementById('event-text').innerText = type;
            setTimeout(() => { popup.classList.remove('show'); popup.classList.add('hide'); }, 1800);
        }

        function triggerSpecialAnim(type, fromSync = false) {
            if(!isOBSMode && !fromSync) syncChannel.postMessage({ type: 'special_anim', animType: type });
            
            if (type === 'FOUR') {
                const wrapper = document.getElementById('anim-four'); const text = document.getElementById('four-text');
                if(!wrapper || !text) return;
                wrapper.classList.remove('active'); text.classList.remove('active'); void wrapper.offsetWidth;
                wrapper.classList.add('active'); text.classList.add('active');
                setTimeout(() => { wrapper.classList.remove('active'); text.classList.remove('active'); }, 4500);
            } 
            else if (type === 'SIX') {
                const wrapper = document.getElementById('anim-six'); const text = document.getElementById('six-text');
                if(!wrapper || !text) return;
                wrapper.classList.remove('active'); text.classList.remove('active'); void wrapper.offsetWidth;
                wrapper.classList.add('active'); text.classList.add('active');
                setTimeout(() => { wrapper.classList.remove('active'); text.classList.remove('active'); }, 5000);
            }
            else if (type === 'OUT') {
                const wrapper = document.getElementById('anim-out'); const text = document.getElementById('out-text');
                const ball = document.getElementById('out-ball'); const s2 = document.getElementById('out-s2');
                const b1 = document.getElementById('out-b1'); const b2 = document.getElementById('out-b2');
                if(!wrapper) return;

                wrapper.classList.remove('active'); text.classList.remove('active'); ball.classList.remove('active');
                s2.classList.remove('active'); b1.classList.remove('active'); b2.classList.remove('active');
                void wrapper.offsetWidth;

                wrapper.classList.add('active'); text.classList.add('active'); ball.classList.add('active');
                s2.classList.add('active'); b1.classList.add('active'); b2.classList.add('active');
                setTimeout(() => { 
                    wrapper.classList.remove('active'); text.classList.remove('active'); ball.classList.remove('active');
                    s2.classList.remove('active'); b1.classList.remove('active'); b2.classList.remove('active'); 
                }, 4500);
            }
        }

        function overCompletionCheck() {
            if(matchState.balls > 0 && matchState.balls % 6 === 0) {
                rotateStrike(); let bStats = getBowlerStats(matchState.bowlerName); if(matchState.currentOverRuns === 0) bStats.maidens++; matchState.currentOverRuns = 0; 
                setTimeout(() => {
                    matchState.thisOver = []; matchState.bowlerName = "";
                    if(!isOBSMode) { document.getElementById('bowler-select').value = ""; document.getElementById('bowler-select').classList.add('bowler-alert'); }
                    updateUI();
                }, 2000);
            }
        }

        function handleBall(val) {
            if(matchState.wickets >= 10 || matchState.bowlerName === "") return; saveHistory(); matchState.thisOver.push(val);
            const striker = getActiveBattingTeam().players[matchState.crease[matchState.strikerPos]]; const bStats = getBowlerStats(matchState.bowlerName);
            matchState.runs += val; matchState.currentOverRuns += val; matchState.balls++; matchState.partnership.runs += val; matchState.partnership.balls++;
            striker.runs += val; striker.balls++; bStats.runs += val; bStats.balls++;
            
            if(val === 4) { triggerAnim('FOUR'); triggerSpecialAnim('FOUR'); }
            if(val === 6) { triggerAnim('SIX'); triggerSpecialAnim('SIX'); }
            
            if(val % 2 !== 0) rotateStrike(); overCompletionCheck(); populateMilestonePlayers(); updateUI();
        }

        function handleExtra(type) {
            if(matchState.bowlerName === "") return; saveHistory(); matchState.thisOver.push(type); 
            matchState.runs += 1; matchState.currentOverRuns += 1; matchState.partnership.runs += 1; matchState.extras += 1; getBowlerStats(matchState.bowlerName).runs += 1; updateUI();
        }

        function handleWicket() {
            if(matchState.wickets >= 10 || matchState.bowlerName === "") return;
            saveHistory(); matchState.thisOver.push('W'); matchState.wickets++; matchState.balls++; matchState.partnership.balls++;
            const striker = getActiveBattingTeam().players[matchState.crease[matchState.strikerPos]]; const bStats = getBowlerStats(matchState.bowlerName);
            striker.balls++; bStats.balls++; bStats.wickets++;
            let assist = document.getElementById('wicket-assist').value; striker.status = assist ? `${assist} b ${matchState.bowlerName}` : `b ${matchState.bowlerName}`; document.getElementById('wicket-assist').value = ""; 
            
            matchState.lastWicket = { name: striker.name, runs: striker.runs, balls: striker.balls };
            const sr = striker.balls > 0 ? ((striker.runs / striker.balls) * 100).toFixed(1) : "0.0";
            matchState.lastFowText = `LAST FOW: ${matchState.runs}-${matchState.wickets} (${striker.name} ${striker.runs}(${striker.balls}) SR:${sr})`;
            matchState.partnership = {runs: 0, balls: 0}; 

            triggerAnim('OUT');
            triggerSpecialAnim('OUT');

            const row = document.getElementById(`row-${matchState.strikerPos}`); row.classList.add('fade-out');
            setTimeout(() => {
                matchState.crease[matchState.strikerPos] = matchState.nextBatterIdx < 11 ? matchState.nextBatterIdx++ : null;
                overCompletionCheck(); updateUI();
                row.classList.replace('fade-out', 'fade-in'); setTimeout(() => row.classList.remove('fade-in'), 500);
            }, 500);
        }

        function rotateStrike() { if(matchState.wickets >= 10) return; matchState.strikerPos = matchState.strikerPos === 0 ? 1 : 0; }
        function undoBall() { if(history.length > 0) { matchState = JSON.parse(history.pop()); if(!isOBSMode) localStorage.setItem('cricketMatchState', JSON.stringify(matchState)); updateUI(); } }

        function handleToggle(id) { const el = document.getElementById(id); if(el) { el.checked = !el.checked; updateUI(); updTicker(); } }

        function loadManualData() {
            document.getElementById('man-runs').value = matchState.runs; document.getElementById('man-wkts').value = matchState.wickets;
            document.getElementById('man-balls').value = matchState.balls; document.getElementById('man-extras').value = matchState.extras;
            const batTeam = getActiveBattingTeam(); const p0 = batTeam.players[matchState.crease[0]]; const p1 = batTeam.players[matchState.crease[1]];
            if(p0) { document.getElementById('man-p0-runs').value = p0.runs; document.getElementById('man-p0-balls').value = p0.balls; }
            if(p1) { document.getElementById('man-p1-runs').value = p1.runs; document.getElementById('man-p1-balls').value = p1.balls; }
        }

        function applyManualData() {
            matchState.runs = parseInt(document.getElementById('man-runs').value) || 0; matchState.wickets = parseInt(document.getElementById('man-wkts').value) || 0;
            matchState.balls = parseInt(document.getElementById('man-balls').value) || 0; matchState.extras = parseInt(document.getElementById('man-extras').value) || 0;
            const batTeam = getActiveBattingTeam(); const p0 = batTeam.players[matchState.crease[0]]; const p1 = batTeam.players[matchState.crease[1]];
            if(p0) { p0.runs = parseInt(document.getElementById('man-p0-runs').value) || 0; p0.balls = parseInt(document.getElementById('man-p0-balls').value) || 0; }
            if(p1) { p1.runs = parseInt(document.getElementById('man-p1-runs').value) || 0; p1.balls = parseInt(document.getElementById('man-p1-balls').value) || 0; }
            saveHistory(); updateUI(); alert("Match data manually overridden successfully!");
        }

        function updateUI(fromSync = false) {
            if(!isOBSMode && !fromSync) {
                const safeCheck = (id) => document.getElementById(id)?.checked ?? true;
                matchState.toggles.title = document.getElementById('tog-title')?.checked ?? true;
                matchState.toggles.ticker = document.getElementById('tog-ticker')?.checked ?? false;
                matchState.toggles.tgt = document.getElementById('tog-tgt')?.checked ?? false;
                matchState.toggles.crr = safeCheck('tog-crr'); matchState.toggles.rrr = document.getElementById('tog-rrr')?.checked ?? false;
                matchState.toggles.eq = safeCheck('tog-eq'); matchState.toggles.toss = safeCheck('tog-toss');
                matchState.toggles.part = safeCheck('tog-part'); matchState.toggles.fow = safeCheck('tog-fow');
                matchState.matchTitle = document.getElementById('match-title-input')?.value || "";
            }

            const shouldHideBoard = !isBoardVisible || activeOverlay !== null;
            document.getElementById('scoreboard-wrapper').classList.toggle('hidden', shouldHideBoard);

            updateTextWithAnim('total-runs', matchState.runs); updateTextWithAnim('total-wickets', matchState.wickets); updateTextWithAnim('total-overs', `${Math.floor(matchState.balls/6)}.${matchState.balls%6}`);

            const batTeam = getActiveBattingTeam(); const bowlTeam = getActiveBowlingTeam();
            [0, 1].forEach(pos => {
                const pIdx = matchState.crease[pos];
                if(pIdx !== null && batTeam.players[pIdx]) {
                    document.getElementById(`disp-p${pos}-name`).innerText = batTeam.players[pIdx].name; updateTextWithAnim(`p${pos}-runs`, batTeam.players[pIdx].runs); updateTextWithAnim(`p${pos}-balls`, batTeam.players[pIdx].balls);
                } else { document.getElementById(`disp-p${pos}-name`).innerText = "(OUT)"; updateTextWithAnim(`p${pos}-runs`, "-"); updateTextWithAnim(`p${pos}-balls`, "-"); }
            });

            // BUG 5 FIX: Animate Bat Indicator safely when Y position changes
            const indicator = document.getElementById('active-batter-indicator');
            if(indicator) { 
                const newTransform = matchState.strikerPos === 0 ? 'translateY(-13px)' : 'translateY(13px)';
                if(indicator.style.transform !== newTransform) {
                    indicator.style.transform = newTransform;
                    indicator.classList.remove('bat-spin');
                    void indicator.offsetWidth;
                    indicator.classList.add('bat-spin');
                }
            }

            // BUG 4 FIX: Check Dataset so it doesn't constantly redraw & blink
            const bowlerEl = document.getElementById('disp-bowler');
            const newBowlerName = matchState.bowlerName || "\u00A0";
            if (bowlerEl.dataset.bowler !== newBowlerName) {
                bowlerEl.innerText = newBowlerName;
                bowlerEl.dataset.bowler = newBowlerName;
                bowlerEl.classList.remove('bowler-anim');
                void bowlerEl.offsetWidth;
                bowlerEl.classList.add('bowler-anim');
            }
            
            const t1 = document.getElementById('disp-t1'); const t2 = document.getElementById('disp-t2');
            t1.innerText = matchState.team1.shortName || matchState.team1.name; t2.innerText = matchState.team2.shortName || matchState.team2.name;
            if(matchState.battingTeam===1) { t1.classList.add('active-batting'); t2.classList.remove('active-batting'); } else { t2.classList.add('active-batting'); t1.classList.remove('active-batting'); }

            const logoLeft = document.getElementById('logo-left'); const logoRight = document.getElementById('logo-right');
            if (batTeam.logo) { logoLeft.src = batTeam.logo; logoLeft.style.display = 'block'; } else { logoLeft.style.display = 'none'; }
            if (bowlTeam.logo) { logoRight.src = bowlTeam.logo; logoRight.style.display = 'block'; } else { logoRight.style.display = 'none'; }

            const overs = Math.floor(matchState.balls/6) + (matchState.balls%6)/6; const crr = matchState.balls === 0 ? "0.00" : (matchState.runs / overs).toFixed(2); let rrr = "0.00";
            
            const titleBox = document.getElementById('disp-title'); const eqBox = document.getElementById('disp-equation'); 
            const tossBox = document.getElementById('disp-toss'); const partBox = document.getElementById('disp-partnership'); 
            const fowBox = document.getElementById('disp-lastfow');
            
            if(matchState.toggles.title && matchState.matchTitle) { titleBox.innerText = matchState.matchTitle; titleBox.classList.add('show'); } else { titleBox.classList.remove('show'); }

            if(matchState.innings === 2) {
                const remOvers = matchState.totalOvers - overs; const remRuns = matchState.target - matchState.runs; const remBalls = (matchState.totalOvers * 6) - matchState.balls;
                rrr = (remOvers > 0 && remRuns > 0) ? (remRuns / remOvers).toFixed(2) : (remRuns <= 0 ? "DONE" : "N/A");
                if(remRuns > 0 && remBalls > 0 && matchState.toggles.eq) { eqBox.innerText = `${batTeam.name} NEED ${remRuns} FROM ${remBalls} TO WIN`; eqBox.classList.add('show'); } else { eqBox.classList.remove('show'); }
            } else { eqBox.classList.remove('show'); }
            
            if(matchState.toss && matchState.toss.text && matchState.toggles.toss) { tossBox.innerText = matchState.toss.text; tossBox.classList.add('show'); } else { tossBox.classList.remove('show'); }
            if(matchState.toggles.part && matchState.isStarted) { partBox.innerText = `PARTNERSHIP: ${matchState.partnership.runs} (${matchState.partnership.balls})`; partBox.classList.add('show'); } else { partBox.classList.remove('show'); }
            if(matchState.toggles.fow && matchState.lastFowText) { fowBox.innerText = matchState.lastFowText; fowBox.classList.add('show'); } else { fowBox.classList.remove('show'); }

            document.getElementById('val-crr').innerText = crr; document.getElementById('val-rrr').innerText = rrr; document.getElementById('val-tgt').innerText = matchState.target;
            
            const setTgClass = (id, show) => { const el = document.getElementById(id); if(el) el.className = `toggle-stat ${show ? 'show' : ''} ${id==='disp-tgt'?'target-item':''}`; };
            setTgClass('disp-tgt', matchState.toggles.tgt && matchState.innings===2);
            setTgClass('disp-crr', matchState.toggles.crr);
            setTgClass('disp-rrr', matchState.toggles.rrr && matchState.innings===2);

            const container = document.getElementById('this-over-container');
            const currentOverStr = JSON.stringify(matchState.thisOver);
            if (container.dataset.over !== currentOverStr) {
                container.innerHTML = '';
                matchState.thisOver.forEach((ball, idx) => {
                    let div = document.createElement('div'); div.className = 'ball-circle';
                    if(ball === 'W') { div.style.background = '#ff5252'; div.style.color = 'white'; } else if(ball === 'Wd' || ball === 'Nb') { div.style.background = '#e0e0e0'; } else if(ball === 4 || ball === 6) { div.style.borderColor = '#1a237e'; div.style.color = '#1a237e'; } else if(ball === 'B' || ball === 'Lb') { div.style.background = '#fff3e0'; }
                    div.innerText = ball; 
                    if(idx === matchState.thisOver.length - 1) div.style.animation = "popInBall 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards";
                    else { div.style.animation = "none"; div.style.opacity = "1"; div.style.transform = "scale(1)"; }
                    container.appendChild(div);
                });
                container.dataset.over = currentOverStr;
            }

            const resCover = document.getElementById('match-result-display');
            if(matchState.showMatchResult) { document.getElementById('match-result-text').innerText = matchState.matchResultText; resCover.classList.add('show'); } 
            else { resCover.classList.remove('show'); }

            const tickCont = document.getElementById('ticker-container');
            if (tickCont) {
                document.getElementById('ticker-text').innerText = matchState.ticker.text;
                if(matchState.toggles.ticker && matchState.ticker.text) { tickCont.classList.remove('hidden'); } else { tickCont.classList.add('hidden'); }
            }

            if(!isOBSMode && !fromSync) { pushSyncUpdate(); localStorage.setItem('cricketMatchState', JSON.stringify(matchState)); }
        }
        
        if(!isOBSMode) {
            loadFromMemory(); updStyle(); updTicker(); updateCheatSheet(); 
            setInterval(pushSyncUpdate, 1000); 

            document.querySelectorAll('.short-key').forEach(input => {
                input.addEventListener('keydown', (e) => {
                    e.preventDefault();
                    let key = e.key.toLowerCase();
                    if(key === 'escape' || key === 'delete' || key === 'backspace') key = '';
                    if(key === ' ') key = 'space';
                    e.target.value = key;
                    const stateKey = e.target.id.replace('key-', '');
                    matchState.shortcuts[stateKey] = key;
                    saveHistory(); updateCheatSheet();
                });
            });

            document.addEventListener('keydown', function(event) {
                // BUG 1 FIX: Extra safety to ensure shortcuts NEVER block active input typing
                const activeTag = document.activeElement ? document.activeElement.tagName.toUpperCase() : '';
                if (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag) && !document.activeElement.classList.contains('short-key')) return;

                let key = event.key.toLowerCase();
                if(key === ' ') key = 'space';
                const s = matchState.shortcuts;

                if (matchState.isStarted) {
                    if (key === s.run0 && s.run0) handleBall(0);
                    else if (key === s.run1 && s.run1) handleBall(1);
                    else if (key === s.run2 && s.run2) handleBall(2);
                    else if (key === s.run3 && s.run3) handleBall(3);
                    else if (key === s.run4 && s.run4) handleBall(4);
                    else if (key === s.run6 && s.run6) handleBall(6);
                    else if (key === s.wd && s.wd) handleExtra('Wd');
                    else if (key === s.nb && s.nb) handleExtra('Nb');
                    else if (key === s.b && s.b) handleExtra('B');
                    else if (key === s.lb && s.lb) handleExtra('Lb');
                    else if (key === s.out && s.out) handleWicket();
                    else if (key === s.undo && s.undo) undoBall();
                    else if (key === s.trigFreeHit && s.trigFreeHit) triggerAnim('FREE HIT');
                    else if (key === s.trigHatTrick && s.trigHatTrick) triggerAnim('HAT TRICK');
                    else if (key === s.animFour && s.animFour) { triggerAnim('FOUR'); triggerSpecialAnim('FOUR'); }
                    else if (key === s.animSix && s.animSix) { triggerAnim('SIX'); triggerSpecialAnim('SIX'); }
                    else if (key === s.animOut && s.animOut) { triggerAnim('OUT'); triggerSpecialAnim('OUT'); }
                }

                if (key === s.togMain && s.togMain) toggleOverlay('main');
                else if (key === s.togFow && s.togFow) toggleOverlay('fow');
                else if (key === s.togBat && s.togBat) toggleOverlay('batting');
                else if (key === s.togBowl && s.togBowl) toggleOverlay('bowling');
                else if (key === s.togYtb && s.togYtb) toggleOverlay('yettobat');
                else if (key === s.hideAll && s.hideAll) executeOverlay('hide_all');
                else if (key === s.showMile && s.showMile) triggerMilestone();
                else if (key === s.hideMile && s.hideMile) hideMilestone();
                else if (key === s.ltBatter && s.ltBatter) triggerLThird('BATTER');
                else if (key === s.ltBowler && s.ltBowler) triggerLThird('BOWLER');
                else if (key === s.hideLt && s.hideLt) hideLThird();
                
                else if (key === s.togTitle && s.togTitle) handleToggle('tog-title');
                else if (key === s.togTicker && s.togTicker) handleToggle('tog-ticker');
                else if (key === s.togTgt && s.togTgt) handleToggle('tog-tgt');
                else if (key === s.togCrr && s.togCrr) handleToggle('tog-crr');
                else if (key === s.togRrr && s.togRrr) handleToggle('tog-rrr');
                else if (key === s.togEq && s.togEq) handleToggle('tog-eq');
                else if (key === s.togToss && s.togToss) handleToggle('tog-toss');
                else if (key === s.togPart && s.togPart) handleToggle('tog-part');
                else if (key === s.togFowGraphic && s.togFowGraphic) handleToggle('tog-fow');
            });
        }