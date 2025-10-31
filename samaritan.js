$State = {
    isText: false,
    wordTime: 750, // Time to display a word
    wordAnim: 150, // Time to animate a word
    randomInterval: 18000,
    lastRandomIndex: -1,
    randomTimer: null,
    lastMouseUp: -1,
    audioStopTimer: null,
    audioUnlocked: false,
    muted: false,
    humBaseVolume: 1.0
};

// From Stack Overflow
// http://stackoverflow.com/questions/1582534/calculating-text-width-with-jquery
$.fn.textWidth = function(){
  var html_org = $(this).html();
  var html_calc = '<span>' + html_org + '</span>';
  $(this).html(html_calc);
  var width = $(this).find('span:first').width();
  $(this).html(html_org);
  return width;
};

// http://stackoverflow.com/questions/19491336/get-url-parameter-jquery
function getUrlParameter(sParam)
{
    var sPageURL = window.location.search.substring(1);
    var sURLVariables = sPageURL.split('&');
    for (var i = 0; i < sURLVariables.length; i++) 
    {
        var sParameterName = sURLVariables[i].split('=');
        if (sParameterName[0] == sParam) 
        {
            return sParameterName[1];
        }
    }
}     

function processMessageFromHash()
{
    var message = decodeURIComponent(window.location.hash.slice(1));
    if (message)
    {
        // 僅記錄待顯示句子，不自動顯示
        $State.pendingPhrase = message;
    }
}

$(document).ready(function(){
    // Cache the jquery things
    $State.triangle = $('#triangle');
    $State.text  = $('#main p');
    $State.line = $('#main hr');
    
    // Start the triangle blinking
    blinkTriangle();

    // URL parameter message
    var urlMsg = getUrlParameter('msg');
    if (urlMsg !== undefined)
    {
        urlMsg = urlMsg.split('%20').join(' ').split('%22').join('').split('%27').join("'");
        $State.phraselist = [urlMsg];
        setTimeout(function(){executeSamaritan(urlMsg);}, $State.wordTime);
    }
    else
    {
      // Message from URL fragment
      processMessageFromHash();
    }

    // Show a new message whenever the URL fragment changes
    $(window).on('hashchange', processMessageFromHash);

    // Pull up the phrase list file
    $.ajax({
      dataType: "json",
      url: "phraselist.json"
    }).done(function(phraselist){
        // Store the phrase list in the state
        if ($State.phraselist !== undefined)
            phraselist = phraselist.concat($State.phraselist);
        $State.phraselist = phraselist;

        $(document).bind("mouseup", function(){
            if ((Date.now() - $State.lastMouseUp) <= 500)
            {
                console.log("DblClick");
                if (screenfull.enabled) {
                    screenfull.toggle();
                }
            }
            $State.lastMouseUp = Date.now();
        }).bind("click", runRandomPhrase);

        // Bind mute toggle button and keyboard shortcut
        $('#muteToggle').on('click', function(){ toggleMute(); });
        $(document).on('keydown', function(e){
            var k = e.key || e.code || '';
            if (typeof k === 'string' && k.toLowerCase() === 'm') {
                toggleMute();
            }
        });

        // 取消進入頁面即自動顯示，改為僅在點擊時顯示
    });
})

var blinkTriangle = function()
{
    // Stop blinking if samaritan is in action
    if ($State.isText)
        return;
    $State.triangle.fadeTo(500, 0).fadeTo(500, 1, blinkTriangle);
}

var currentPhraseIndex = 0;

var runRandomPhrase = function()
{
    // Show next phrase in order instead of random
    if ($State.phraselist && $State.phraselist.length > 0) {
        ensureAudioReady();
        executeSamaritan($State.phraselist[currentPhraseIndex]);
        currentPhraseIndex = (currentPhraseIndex + 1) % $State.phraselist.length;
    }
}

var randomTimePhrase = function()
{
    if ($State.randomTimer !== null)
        clearTimeout($State.randomTimer);
    var randomTime = Math.floor(Math.random() * (3000 - 0));
    randomTime += $State.randomInterval;
    $State.randomTimer = setTimeout( runRandomPhrase, randomTime);
}

var executeSamaritan = function(phrase)
{
    if ($State.isText)
        return;

    $State.isText = true
    var phraseArray = phrase.split(" ");
    // First, finish() the blink animation and
    // scale down the marker triangle
    $State.triangle.finish().animate({
        'font-size': '0em',
        'opacity': '1'
    }, {
        'duration': $State.wordAnim,
        // Once animation triangle scale down is complete...
        'done': function() {
            var timeStart = 0;
            // Create timers for each word
            phraseArray.forEach(function (word, i) {
                var wordTime = $State.wordTime;
                if (word.length > 8)
                    wordTime *= (word.length / 8);
                setTimeout(function(){
                    // Set the text to black, and put in the word
                    // so that the length can be measured
                    $State.text.addClass('hidden').html(word);
                    // Then animate the line with extra padding
                    $State.line.animate({
                        'width' : ($State.text.textWidth() + 18) + "px"
                    }, {
                        'duration': $State.wordAnim,
                        // When line starts anmating, set text to white again
                        'start': $State.text.removeClass('hidden')
                    })
                }, (timeStart + $State.wordAnim));
                timeStart += wordTime;
            });

            // Start hum audio aligned to first word and stop at sentence end
            var totalDisplay = timeStart + $State.wordTime;
            var audioDuration = Math.max(0, totalDisplay - $State.wordAnim);
            if ($State.audioUnlocked) {
                setTimeout(function(){ startHumAudio(audioDuration); }, $State.wordAnim);
            }

            // Set a final timer to hide text and show triangle
            setTimeout(function(){
                // Clear the text
                $State.text.html("");
                // Animate trinagle back in
                $State.triangle.finish().animate({
                    'font-size': '2em',
                    'opacity': '1'
                }, {
                    'duration': $State.wordAnim,
                    // Once complete, blink the triangle again and animate the line to original size
                    'done': function(){
                        $State.isText = false;

                        blinkTriangle();
                        $State.line.animate({
                            'width' : "30px"
                        }, {
                            'duration': $State.wordAnim,
                            'start': $State.text.removeClass('hidden')
                        })
                    }
                });
            },
            totalDisplay);
        }
    });
}

document.addEventListener('DOMContentLoaded', function(){
    $State.humAudio = document.getElementById('humAudio');
    if ($State.humAudio) {
        $State.humAudio.addEventListener('loadedmetadata', function(){
            $State.humDuration = $State.humAudio.duration;
        });
        try { $State.humAudio.load(); } catch(e){}
    }
    try {
        var m = localStorage.getItem('muted');
        if (m === '1') $State.muted = true;
    } catch(e) {}
    applyMuteState();
});

function ensureAudioReady() {
    return new Promise(function(resolve){
        if (!$State.humAudio) {
            $State.humAudio = document.getElementById('humAudio');
        }
        if (!$State.humAudio) { resolve(false); return; }
        if ($State.audioUnlocked) { resolve(true); return; }
        var a = $State.humAudio;
        var prevVol = a.volume;
        try {
            a.volume = 0;
            var p = a.play();
            if (p && typeof p.then === 'function') {
                p.then(function(){
                    a.pause();
                    a.currentTime = 0;
                    a.volume = prevVol;
                    $State.audioUnlocked = true;
                    resolve(true);
                }).catch(function(){
                    a.volume = prevVol;
                    resolve(false);
                });
            } else {
                a.pause();
                a.currentTime = 0;
                a.volume = prevVol;
                $State.audioUnlocked = true;
                resolve(true);
            }
        } catch(e) {
            a.volume = prevVol;
            resolve(false);
        }
    });
}

function applyMuteState() {
    var a = $State.humAudio;
    if (a) {
        a.muted = $State.muted;
        if (!$State.muted) {
            a.volume = $State.humBaseVolume;
        }
    }
    var btn = document.getElementById('muteToggle');
    if (btn) {
        btn.setAttribute('aria-pressed', $State.muted ? 'true' : 'false');
        // Swap icon based on state: muted = speaker with slash; unmuted = speaker with waves
        var iconUnmuted = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">\n            <path d="M5 9 H9 L14 6 V18 L9 15 H5 Z" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round" stroke-linecap="round"></path>\n            <path d="M16 9 C18 11 18 13 16 15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"></path>\n            <path d="M18 7 C21 11 21 13 18 17" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"></path>\n        </svg>';
        var iconMuted = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">\n            <path d="M5 9 H9 L14 6 V18 L9 15 H5 Z" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round" stroke-linecap="round"></path>\n            <path d="M15 7 L22 16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"></path>\n        </svg>';
        btn.innerHTML = $State.muted ? iconMuted : iconUnmuted;
        btn.title = $State.muted ? 'Unmute' : 'Mute';
        btn.setAttribute('aria-label', $State.muted ? 'Unmute' : 'Mute');
    }
}

function toggleMute() {
    $State.muted = !$State.muted;
    try { localStorage.setItem('muted', $State.muted ? '1' : '0'); } catch(e){}
    applyMuteState();
}

function stopHumAudio() {
    if (!$State.humAudio) return;
    $State.humAudio.pause();
    $State.humAudio.currentTime = 0;
    $State.humAudio.playbackRate = 1.0;
    $State.humAudio.loop = false;
}

function startHumAudio(desiredDuration) {
    if (!$State.humAudio) return;
    if ($State.audioStopTimer !== null) {
        clearTimeout($State.audioStopTimer);
        $State.audioStopTimer = null;
    }
    try { $State.humAudio.pause(); } catch(e){}
    $State.humAudio.currentTime = 0;

    var duration = $State.humAudio.duration;
    var minRate = 0.5, maxRate = 4.0;
    var desiredRate = (!isNaN(duration) && isFinite(duration) && desiredDuration > 0) ? (duration / desiredDuration) : 1.0;
    var rate = Math.max(minRate, Math.min(maxRate, desiredRate));
    try {
        $State.humAudio.playbackRate = rate;
    } catch(e) {
        $State.humAudio.playbackRate = 1.0;
    }

    // Ensure continuous hum throughout sentence
    $State.humAudio.loop = true;

    // Apply mute/base volume and respect unlock before play
    $State.humAudio.muted = $State.muted;
    if (!$State.muted) {
        $State.humAudio.volume = $State.humBaseVolume;
    }
    if ($State.audioUnlocked) {
        var playPromise = $State.humAudio.play();
        if (playPromise && typeof playPromise.then === 'function') {
            playPromise.catch(function(err){});
        }
    }

    var fadeMs = Math.min($State.wordAnim, 200);
    if (fadeMs > 0) {
        var startVol = $State.humAudio.volume;
        var steps = 5;
        var stepMs = Math.max(10, Math.floor(fadeMs / steps));
        $State.audioStopTimer = setTimeout(function(){
            var i = 0;
            var tick = function(){
                i++;
                $State.humAudio.volume = Math.max(0, startVol * (1 - i/steps));
                if (i >= steps) {
                    stopHumAudio();
                    $State.humAudio.volume = startVol;
                } else {
                    setTimeout(tick, stepMs);
                }
            };
            tick();
        }, Math.max(0, desiredDuration - fadeMs));
    } else {
        $State.audioStopTimer = setTimeout(function(){
            stopHumAudio();
        }, Math.max(0, desiredDuration));
    }
}
