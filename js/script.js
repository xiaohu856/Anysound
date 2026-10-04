 // ============================================
// 混合内容安全代理函数（Netlify 版）
// ============================================
function secureFetch(url, options) {
    options = options || {};
    if (window.location.protocol === 'https:' && url.startsWith('http://')) {
        if (url.includes('kuwo.bfmzdx.cn')) {
            var urlObj = new URL(url);
            var path = urlObj.pathname + urlObj.search;
            var proxyUrl = '/api/kuwo' + path.replace('/kuwo', '');
            return fetch(proxyUrl, options);
        }
        var httpsUrl = url.replace('http://', 'https://');
        return fetch(httpsUrl, options).catch(function() {
            return fetch(url, options);
        });
    }
    return fetch(url, options);
}

function ensureHttpsUrl(url) {
    if (!url || typeof url !== 'string') return url;
    if (url.startsWith('http://')) return url.replace('http://', 'https://');
    return url;
}

// ============================================
// 全局变量
// ============================================

var currentUser = null;
var isLoggedIn = false;
var rememberMe = false;

var currentSongs = [];
var currentIndex = -1;
var currentQuality = 'hires';
var isPlaying = false;
var searchInProgress = false;
var volume = 1.0;
var favorites = [];
var playHistory = [];
var playlists = [];
var currentPlaylistId = null;
var pendingSongToAdd = null;

// 播放列表 DOM 引用
var playlistsGrid = document.getElementById('playlistsGrid');
var playlistDetailList = document.getElementById('playlistDetailList');
var playlistDetailName = document.getElementById('playlistDetailName');
var playlistDetailCount = document.getElementById('playlistDetailCount');
var playlistModal = document.getElementById('playlistModal');
var playlistModalTitle = document.getElementById('playlistModalTitle');
var playlistNameInput = document.getElementById('playlistNameInput');
var addToPlaylistModal = document.getElementById('addToPlaylistModal');
var playlistSelectList = document.getElementById('playlistSelectList');
var sleepTimerIndicator = document.getElementById('sleepTimerIndicator');
var sleepTimerRemaining = document.getElementById('sleepTimerRemaining');
var currentPage = 'home';
var _navStack = [];
var _isPoppingState = false;
var _activeSongCardEl = null;
var _activeSongId = null;
var currentPlatform = 'all';

var lyricsData = [];
var lyricsLines = [];
var isLyricsScrolling = true;
var lyricsLoading = false;
var lastLyricIndex = -1;
var lastLyricTime = -1;

var dynamicBackground = null;
var fullscreenDynamicBg = null;
var currentBackgroundUrl = ''

var downloadTimer = null;
var downloadCountdown = 3;
var APP_DOWNLOAD_URL = '/anysound_26.19.6_download.html';

var settings = {
    darkTheme: false,
    animations: true,
    coverRotation: false,
    autoPlay: true,
    vibration: false,
    qualityPreference: 'hires',
    sidebarCollapsed: false,
    historyEnabled: true,
    historyLimit: 100,
    dataBackup: true,
    backupFolderName: '',
    superPerformance: false,
    showLyrics: true,
    floatingLyricsEnabled: true,
    dynamicBackground: true,
    rememberLastPosition: false,
    playMode: 'list',
    crossfade: false,
    crossfadeDuration: 3000,
    autoFullscreen: true,
    themeColor: '#7c3aed',
    fontFamily: 'Inter, system-ui, sans-serif',
    sleepTimer: 0,
    volNormalize: false,
    devMode: false,
    showFPS: false,
    fpsColor: '#00ff00',
    fpsSize: 16,
    fpsBgOpacity: 0,
    fpsPanelExpanded: true,
    liquidGlass: false,
    disableAnimations: false,
    showElementBounds: false,
    crossfadePanelExpanded: false,
    historyPanelExpanded: false,
    backupPanelExpanded: false,
    floatingLyricsColor: '#ffffff',
    floatingLyricsSize: 18,
    floatingLyricsBgOpacity: 0,
    floatingLyricsOpacity: 100,
    floatingLyricsX: 50,
    floatingLyricsY: 0,
    floatingLyricsPanelExpanded: false,
    autoSwitchOnNeteaseError: true,
    coverTransition: 'flip3d',
    mobileAndroidStyle: true,
    uiMode: 'simple'
};

var lastPlaybackState = {
    songId: null,
    currentTime: 0,
    isPlaying: false,
    quality: 'hires'
};

var lastPagePosition = {
    page: 'home',
    scrollTop: 0
};

var currentFadeInterval = null;
var currentFadeOutInterval = null;
var isCrossfading = false;
var crossfadeTriggered = false;
var coverTransitionDirection = 'none';

var currentChartType = '热歌榜';

var qualityNames = {
    'standard': '标准音质',
    'higher': '较高音质',
    'exhigh': '极高音质',
    'lossless': '无损音质',
    'hires': '母带音质'
};

var LINE_HEIGHT = 20;
var LYRICS_OFFSET = window.innerHeight / 3.5;

var originalTitle = 'Any Sound - 免费音乐播放器';

function debounce(fn, delay) { var t; return function() { var ctx = this, args = arguments; clearTimeout(t); t = setTimeout(function() { fn.apply(ctx, args); }, delay); }; }

var searchHistory = [];
var SEARCH_HISTORY_KEY = 'anyListen_searchHistory';

var announcementShownThisSession = false;
var APP_VERSION = '26.24.5';
var ANNOUNCEMENT_CONTENT = 'Anysound更新公告\n\n已在26年8月28日完成26.24.5版本更新\n更新内容：\n1. 修复 App 内置浏览器无法播放歌曲和加载封面的问题\nv26.24.5\n\n注：如果网易云不可用，请切换为酷我平台！\n响应速度:\n网易云:慢\n酷我/酷狗:快';

// DOM 元素引用
var sidebar = document.getElementById('sidebar');
var hamburgerMenu = document.getElementById('hamburgerMenu');
var sidebarToggleDesktop = document.getElementById('sidebarToggleDesktop');
var mainContent = document.querySelector('.main-content');
var userStatus = document.getElementById('userStatus');
var themeToggle = document.getElementById('themeToggle');
var overlay = document.getElementById('overlay');

dynamicBackground = document.getElementById('dynamicBackground');
fullscreenDynamicBg = document.getElementById('fullscreenDynamicBg');

var loginModal = document.getElementById('loginModal');
var closeLoginModal = document.getElementById('closeLoginModal');
var loginTabBtn = document.getElementById('loginTabBtn');
var registerTabBtn = document.getElementById('registerTabBtn');
var loginForm = document.getElementById('loginForm');
var registerForm = document.getElementById('registerForm');
var loginBtn = document.getElementById('loginBtn');
var registerBtn = document.getElementById('registerBtn');
var authError = document.getElementById('authError');
var authErrorText = document.getElementById('authErrorText');
var rememberMeCheckbox = document.getElementById('rememberMe');
var termsAgreementCheckbox = document.getElementById('termsAgreement');
var termsLink = document.getElementById('termsLink');

var donationModal = document.getElementById('donationModal');
var donationBtn = document.getElementById('donationBtn');
var closeDonationModal = document.getElementById('closeDonationModal');

var termsModal = document.getElementById('termsModal');
var closeTermsModal = document.getElementById('closeTermsModal');
var modalTermsAgreement = document.getElementById('modalTermsAgreement');
var closeTermsBtn = document.getElementById('closeTermsBtn');

var accountSettingsModal = document.getElementById('accountSettingsModal');
var closeAccountSettingsModal = document.getElementById('closeAccountSettingsModal');
var updateAccountBtn = document.getElementById('updateAccountBtn');
var accountError = document.getElementById('accountError');
var accountErrorText = document.getElementById('accountErrorText');
var accountInfo = document.getElementById('accountInfo');
var exportAccountDataBtn = document.getElementById('exportAccountDataBtn');
var importAccountDataBtn = document.getElementById('importAccountDataBtn');
var importAccountDataFile = document.getElementById('importAccountDataFile');
var deleteAccountBtn = document.getElementById('deleteAccountBtn');

var downloadAppModal = document.getElementById('downloadAppModal');
var downloadAppBtn = document.getElementById('downloadAppBtn');
var closeDownloadAppModal = document.getElementById('closeDownloadAppModal');
var downloadProgressBar = document.getElementById('downloadProgressBar');
var downloadTimerEl = document.getElementById('downloadTimer');

var userMenu = document.getElementById('userMenu');
var userMenuName = document.getElementById('userMenuName');
var userProfileItem = document.getElementById('userProfileItem');
var userSettingsItem = document.getElementById('userSettingsItem');
var logoutItem = document.getElementById('logoutItem');

var searchInput = document.getElementById('searchInput');
var searchBtn = document.getElementById('searchBtn');
var errorMessage = document.getElementById('errorMessage');
var errorText = document.getElementById('errorText');
var resultsCount = document.getElementById('resultsCount');
var navSearchInput = document.getElementById('navSearchInput');
var navSearchBtn = document.getElementById('navSearchBtn');
var navSearchDropdown = document.getElementById('navSearchDropdown');
var searchHistoryList = document.getElementById('searchHistoryList');
var clearSearchHistoryBtn = document.getElementById('clearSearchHistoryBtn');
var mobileSearchHistoryDropdown = document.getElementById('mobileSearchHistoryDropdown');
var mobileSearchHistoryList = document.getElementById('mobileSearchHistoryList');
var mobileClearSearchHistoryBtn = document.getElementById('mobileClearSearchHistoryBtn');

var platformBtns = document.querySelectorAll('.platform-btn');

var pageContents = document.querySelectorAll('.page-content');
var navItems = document.querySelectorAll('.nav-item');

var playerContainer = document.getElementById('playerContainer');
var audioPlayer = document.getElementById('audioPlayer');
var crossfadePlayer = document.getElementById('crossfadePlayer');
var nowPlayingCover = document.getElementById('nowPlayingCover');
var nowPlayingTitle = document.getElementById('nowPlayingTitle');
var nowPlayingArtist = document.getElementById('nowPlayingArtist');
var playPauseBtn = document.getElementById('playPauseBtn');
var playIcon = document.getElementById('playIcon');
var prevBtn = document.getElementById('prevBtn');
var nextBtn = document.getElementById('nextBtn');
var progressBar = document.getElementById('progressBar');
var progress = document.getElementById('progress');
var currentTimeEl = document.getElementById('currentTime');
var durationEl = document.getElementById('duration');
var volumeSlider = document.getElementById('volumeSlider');
var volumeLevel = document.getElementById('volumeLevel');
var volumeIcon = document.getElementById('volumeIcon');
var volumeBtn = document.getElementById('volumeBtn');
var volumeBtnWrapper = document.getElementById('volumeBtnWrapper');
var volumeDropdown = document.getElementById('volumeDropdown');
var qualityButtons = document.querySelectorAll('.quality-dropdown-item');
var qualityDropdownBtn = document.getElementById('qualityDropdownBtn');
var qualityDropdown = document.getElementById('qualityDropdown');
var qualityLabel = document.getElementById('qualityLabel');

function closeQualityDropdown() {
    if (qualityDropdown) qualityDropdown.classList.remove('open');
    if (qualityDropdownBtn) qualityDropdownBtn.classList.remove('open');
}

function updateQualityLabel() {
    if (qualityLabel) {
        var labels = { 'hires': '母带', 'lossless': '无损', 'exhigh': '极高' };
        qualityLabel.textContent = labels[currentQuality] || currentQuality;
    }
}

var trendingList = document.getElementById('trendingList');
var favoritesList = document.getElementById('favoritesList');
var historyList = document.getElementById('historyList');
var resultsList = document.getElementById('resultsList');
var favoritesCount = document.getElementById('favoritesCount');
var historyCount = document.getElementById('historyCount');
var clearFavoritesBtn = document.getElementById('clearFavoritesBtn');
var importFavoritesBtn = document.getElementById('importFavoritesBtn');
var importFavoritesFile = document.getElementById('importFavoritesFile');
var exportFavoritesBtn = document.getElementById('exportFavoritesBtn');
var clearHistoryBtn = document.getElementById('clearHistoryBtn');
var importHistoryBtn = document.getElementById('importHistoryBtn');
var importHistoryFile = document.getElementById('importHistoryFile');
var exportHistoryBtn = document.getElementById('exportHistoryBtn');
var refreshTrendingBtn = document.getElementById('refreshTrendingBtn');
var btnLoadTrending = document.getElementById('btnLoadTrending');
var totalFavorites = document.getElementById('totalFavorites');
var totalDuration = document.getElementById('totalDuration');
var totalHistory = document.getElementById('totalHistory');
var totalHistoryDuration = document.getElementById('totalHistoryDuration');
var refreshHistoryBtn = document.getElementById('refreshHistoryBtn');

var chartCover = document.getElementById('chartCover');
var chartInfo = document.getElementById('chartInfo');
var hotSongList = document.getElementById('hotSongList');
var refreshHotlistBtn = document.getElementById('refreshHotlistBtn');

var settingsGrid = document.getElementById('settingsGrid');
var settingsModal = document.getElementById('settingsModal');
var closeSettingsModal = document.getElementById('closeSettingsModal');
var settingsCloseBtn = document.getElementById('settingsCloseBtn');
var settingsNavBtn = document.getElementById('settingsNavBtn');

var notification = document.getElementById('notification');
var notificationText = document.getElementById('notificationText');

var toastContainer = document.getElementById('toastContainer');

var fullscreenPlayer = document.getElementById('fullscreenPlayer');
var fullscreenCover = document.getElementById('fullscreenCover');
var fullscreenTitle = document.getElementById('fullscreenTitle');
var fullscreenArtist = document.getElementById('fullscreenArtist');
var fullscreenPlayBtn = document.getElementById('fullscreenPlayBtn');
var fullscreenPlayIcon = document.getElementById('fullscreenPlayIcon');
var fullscreenPrevBtn = document.getElementById('fullscreenPrevBtn');
var fullscreenNextBtn = document.getElementById('fullscreenNextBtn');
var fullscreenProgressBar = document.getElementById('fullscreenProgressBar');
var fullscreenProgress = document.getElementById('fullscreenProgress');
var fullscreenCurrentTime = document.getElementById('fullscreenCurrentTime');
var fullscreenDuration = document.getElementById('fullscreenDuration');
var fullscreenClose = document.getElementById('fullscreenClose');
var fullscreenF11Btn = document.getElementById('fullscreenF11');
var lyricsContainer = document.getElementById('lyricsContainer');
var floatingLyrics = document.getElementById('floatingLyrics');
var floatingLyricsText = document.getElementById('floatingLyricsText');
var floatingLyricsTrans = document.getElementById('floatingLyricsTrans');
var lyricsToggleBtn = document.getElementById('lyricsToggleBtn');
var mobileBackBtn = document.getElementById('mobileLyricsBackBtn');
var fullscreenModeBtn = document.getElementById('fullscreenModeBtn');
var fullscreenSettingsBtn = document.getElementById('fullscreenSettingsBtn');

var fullscreenSettingsModal = document.getElementById('fullscreenSettingsModal');
var closeFullscreenSettingsModal = document.getElementById('closeFullscreenSettingsModal');
var fullscreenSettingsCloseBtn = document.getElementById('fullscreenSettingsCloseBtn');
var fullscreenSettingsGrid = document.getElementById('fullscreenSettingsGrid');

var lyricsElement = null;
var userProfileModal = null;
var dragTooltip = null;
var dragTooltipTimer = null;

// ============================================
// 统一更新平台按钮状态
// ============================================
function updatePlatformButtons(platform) {
    var allBtns = document.querySelectorAll('.platform-btn');
    allBtns.forEach(function(btn) {
        btn.classList.remove('active');
        if (btn.dataset.platform === platform) {
            btn.classList.add('active');
        }
    });
    var dropdownItems = document.querySelectorAll('.platform-dropdown-item');
    dropdownItems.forEach(function(item) {
        item.classList.remove('active');
        if (item.dataset.platform === platform) {
            item.classList.add('active');
        }
    });
    var label = document.getElementById('platformDropdownLabel');
    if (label) {
        if (platform === 'netease') label.textContent = '冈易云';
        else if (platform === 'kuwo') label.textContent = '酷我/酷狗';
        else label.textContent = '聚合搜索';
    }
    var mobileLabel = document.getElementById('mobilePlatformDropdownLabel');
    if (mobileLabel) {
        if (platform === 'netease') mobileLabel.textContent = '冈易云';
        else if (platform === 'kuwo') mobileLabel.textContent = '酷我/酷狗';
        else mobileLabel.textContent = '聚合搜索';
    }
    currentPlatform = platform;
}

// ============================================
// 动态网页标题更新
// ============================================
function updatePageTitle(songName, artistName) {
    if (!songName || songName === '' || songName === 'Any Sound - 听你想听') {
        document.title = originalTitle;
        return;
    }
    if (artistName && artistName !== '-' && artistName !== '') {
        var cleanArtist = artistName.split('·')[0].trim();
        if (cleanArtist === '') cleanArtist = artistName;
        document.title = songName + ' - ' + cleanArtist + ' - Any Sound';
    } else {
        document.title = songName + ' - Any Sound';
    }
}

function resetPageTitle() {
    document.title = originalTitle;
}

// ============================================
// MediaSession API
// ============================================
function updateMediaSessionMetadata(song) {
    if (!('mediaSession' in navigator)) return;
    var metadata = new MediaMetadata({
        title: song.name || '未知歌曲',
        artist: song.artistsname || '未知艺术家',
        album: song.album || 'Any Sound',
        artwork: song.picurl ? [
            { src: song.picurl, sizes: '96x96', type: 'image/jpeg' },
            { src: song.picurl, sizes: '128x128', type: 'image/jpeg' },
            { src: song.picurl, sizes: '192x192', type: 'image/jpeg' },
            { src: song.picurl, sizes: '256x256', type: 'image/jpeg' },
            { src: song.picurl, sizes: '384x384', type: 'image/jpeg' },
            { src: song.picurl, sizes: '512x512', type: 'image/jpeg' }
        ] : []
    });
    navigator.mediaSession.metadata = metadata;
}

function updateMediaSessionPlaybackState() {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    if (audioPlayer.duration && isFinite(audioPlayer.duration)) {
        try {
            navigator.mediaSession.setPositionState({
                duration: audioPlayer.duration,
                playbackRate: audioPlayer.playbackRate || 1,
                position: audioPlayer.currentTime
            });
        } catch (e) {}
    }
}

function showDragTooltip(x, y, text) {
    if (!dragTooltip) {
        dragTooltip = document.createElement('div');
        dragTooltip.className = 'drag-tooltip';
        document.body.appendChild(dragTooltip);
    }
    dragTooltip.textContent = text;
    dragTooltip.style.left = x + 'px';
    dragTooltip.style.top = y + 'px';
    dragTooltip.style.opacity = '1';
    if (dragTooltipTimer) clearTimeout(dragTooltipTimer);
    dragTooltipTimer = setTimeout(function() {
        if (dragTooltip) dragTooltip.style.opacity = '0';
    }, 800);
}

function hideDragTooltip() {
    if (dragTooltip) dragTooltip.style.opacity = '0';
}

function stopAllFades() {
    if (currentFadeInterval) {
        clearInterval(currentFadeInterval);
        currentFadeInterval = null;
    }
    if (currentFadeOutInterval) {
        clearInterval(currentFadeOutInterval);
        currentFadeOutInterval = null;
    }
    crossfadePlayer.pause();
    crossfadePlayer.src = '';
    crossfadePlayer.volume = 0;
    isCrossfading = false;
}

function fadeOutPlayer(player, duration, callback) {
    if (!player.src || player.paused) {
        if (callback) callback();
        return;
    }
    var startVolume = player.volume;
    var stepTime = 30;
    var steps = duration / stepTime;
    var currentStep = 0;
    var fadeOutId = setInterval(function() {
        currentStep++;
        var newVolume = startVolume * (1 - currentStep / steps);
        if (newVolume <= 0.01 || currentStep >= steps) {
            player.volume = 0;
            clearInterval(fadeOutId);
            if (callback) callback();
        } else {
            player.volume = Math.max(0, newVolume);
        }
    }, stepTime);
    return fadeOutId;
}

function fadeInPlayer(player, targetVolume, duration, callback) {
    if (!player.src) {
        if (callback) callback();
        return;
    }
    var startVolume = player.volume;
    var stepTime = 30;
    var steps = duration / stepTime;
    var currentStep = 0;
    var fadeInId = setInterval(function() {
        currentStep++;
        var newVolume = startVolume + (targetVolume - startVolume) * (currentStep / steps);
        if (currentStep >= steps) {
            player.volume = targetVolume;
            clearInterval(fadeInId);
            if (callback) callback();
        } else {
            player.volume = Math.min(targetVolume, Math.max(0, newVolume));
        }
    }, stepTime);
    return fadeInId;
}

function fadeOutCurrent(duration, callback) {
    if (currentFadeOutInterval) clearInterval(currentFadeOutInterval);
    currentFadeOutInterval = fadeOutPlayer(audioPlayer, duration, function() {
        currentFadeOutInterval = null;
        if (callback) callback();
    });
}

function fadeInTo(targetVolume, duration, callback) {
    if (currentFadeInterval) clearInterval(currentFadeInterval);
    currentFadeInterval = fadeInPlayer(audioPlayer, targetVolume, duration, function() {
        currentFadeInterval = null;
        if (callback) callback();
    });
}

function crossfadeSwitch(song, index) {
    if (isCrossfading) {
        stopAllFades();
    }
    isCrossfading = true;
    var originalVolume = volume;
    var crossfadeMs = settings.crossfadeDuration || 3000;

    if (audioPlayer.src && !audioPlayer.paused) {
        getAudioUrl(song.id, currentQuality, song.platform).then(function(audioUrl) {
            crossfadePlayer.src = audioUrl;
            crossfadePlayer.volume = 0;
            crossfadePlayer.play().then(function() {
                var halfDuration = crossfadeMs / 2;
                currentFadeOutInterval = fadeOutPlayer(audioPlayer, halfDuration, function() {
                    currentFadeOutInterval = null;
                    audioPlayer.pause();
                });
                currentFadeInterval = fadeInPlayer(crossfadePlayer, originalVolume, halfDuration, function() {
                    currentFadeInterval = null;
                    audioPlayer.src = crossfadePlayer.src;
                    audioPlayer.currentTime = crossfadePlayer.currentTime;
                    audioPlayer.volume = originalVolume;
                    audioPlayer.play();
                    crossfadePlayer.src = '';
                    crossfadePlayer.volume = 0;
                    isCrossfading = false;
                    currentIndex = index;
                    crossfadeTriggered = false;
                    var songData = song;
                    updateNowPlayingInfo(songData);
                    addToHistory(songData);
                    if (settings.vibration && navigator.vibrate) navigator.vibrate(50);
                    updateMediaSessionPlaybackState();
                });
            }).catch(function() {
                isCrossfading = false;
                crossfadePlayer.src = '';
                playSongWithOptions(song, index, {});
            });
        }).catch(function() {
            isCrossfading = false;
            playSongWithOptions(song, index, {});
        });
    } else {
        isCrossfading = false;
        playSongWithOptions(song, index, {});
    }
}

function updateNowPlayingInfo(song) {
    nowPlayingTitle.textContent = song.name;
    nowPlayingArtist.textContent = song.artistsname + ' · ' + (song.album || '');
    fullscreenTitle.textContent = song.name;
    fullscreenArtist.textContent = song.artistsname + ' · ' + (song.album || '');
    updatePageTitle(song.name, song.artistsname);
    updateAlbumCover(song);
    if (song.picurl && settings.dynamicBackground) {
        updateDynamicBackground(song.picurl);
    }
    updateMediaSessionMetadata(song);
    if (settings.showLyrics) loadLyrics(song.id, song.platform);
    if (song.platform === 'kuwo') {
        if (currentPlatform !== 'all') updatePlatformButtons('kuwo');
    } else {
        if (currentPlatform !== 'all') updatePlatformButtons('netease');
    }
}

// ============================================
// 播放核心
// ============================================
async function playSongWithOptions(song, index, options) {
    options = options || {};
    var startVolume = options.startVolume;
    var fadeIn = options.fadeIn;
    var targetVolume = options.targetVolume;
    var fadeInDuration = options.fadeInDuration;
    showToast('正在加载歌曲，请稍候...', 'info', 1500);
    nowPlayingTitle.textContent = song.name;
    nowPlayingArtist.textContent = song.artistsname + ' · ' + (song.album || '');
    fullscreenTitle.textContent = song.name;
    fullscreenArtist.textContent = song.artistsname + ' · ' + (song.album || '');
    updatePageTitle(song.name, song.artistsname);
    updateAlbumCover(song);
    if (song.picurl && settings.dynamicBackground) {
        updateDynamicBackground(song.picurl);
    }
    updateMediaSessionMetadata(song);
    playerContainer.style.display = 'flex';
    currentIndex = index;
    if (song.platform === 'kuwo') {
        if (currentPlatform !== 'all') updatePlatformButtons('kuwo');
    } else {
        if (currentPlatform !== 'all') updatePlatformButtons('netease');
    }
    if (_activeSongCardEl && _activeSongCardEl.isConnected) {
        _activeSongCardEl.classList.remove('active');
        var oldIndicator = _activeSongCardEl.querySelector('.song-playing-indicator');
        if (oldIndicator) oldIndicator.remove();
    }
    var targetCard = document.querySelector('.song-card[data-id="' + song.id + '"]');
    if (targetCard) {
        targetCard.classList.add('active');
        _activeSongCardEl = targetCard;
        _activeSongId = song.id;
        var cover = targetCard.querySelector('.song-cover');
        if (cover && !cover.querySelector('.song-playing-indicator')) {
            cover.insertAdjacentHTML('beforeend', '<div class="song-playing-indicator"><i class="fas fa-play"></i></div>');
        }
    }
    try {
        var audioUrl = await getAudioUrl(song.id, currentQuality, song.platform);
        audioPlayer.src = audioUrl;
        updateBufferProgress();
        if (startVolume !== undefined) audioPlayer.volume = startVolume;
        else audioPlayer.volume = volume;
        if (settings.coverRotation) {
            nowPlayingCover.classList.remove('playing');
            fullscreenCover.classList.remove('playing');
        }
        if (settings.showLyrics) loadLyrics(song.id, song.platform);
        await new Promise(function(resolve, reject) {
            var timeout = setTimeout(function() { reject(new Error('音频加载超时')); }, 10000);
            var canPlayHandler = function() {
                clearTimeout(timeout);
                audioPlayer.removeEventListener('canplay', canPlayHandler);
                audioPlayer.removeEventListener('error', errorHandler);
                resolve();
            };
            var errorHandler = function(e) {
                clearTimeout(timeout);
                audioPlayer.removeEventListener('canplay', canPlayHandler);
                audioPlayer.removeEventListener('error', errorHandler);
                reject(new Error('音频加载失败'));
            };
            audioPlayer.addEventListener('canplay', canPlayHandler);
            audioPlayer.addEventListener('error', errorHandler);
        });
        await audioPlayer.play();
        isPlaying = true;
        crossfadeTriggered = false;
        playIcon.className = 'fas fa-pause';
        fullscreenPlayIcon.className = 'fas fa-pause';
        if (settings.coverRotation) {
            nowPlayingCover.classList.add('playing', 'cover-rotation');
            fullscreenCover.classList.add('playing', 'cover-rotation');
        }
        if (song.platform === 'kuwo' && !song.kuwo_rid) song.kuwo_rid = song.id;
        addToHistory(song);
        if (settings.vibration && navigator.vibrate) navigator.vibrate(50);
        if (fadeIn && targetVolume !== undefined && fadeInDuration) {
            fadeInTo(targetVolume, fadeInDuration, null);
        }
        if (settings.autoFullscreen && !fullscreenPlayer.classList.contains('show')) {
            openFullscreenPlayer();
        }
        updateMediaSessionPlaybackState();
        showToast('正在播放: ' + song.name, 'success');
    } catch (error) {
        console.error('播放错误:', error);
        showToast('无法播放此歌曲: ' + (error.message || '未知错误'), 'error');
        isCrossfading = false;
        updateMediaSessionPlaybackState();
        resetPageTitle();
        isPlaying = false;
        playIcon.className = 'fas fa-play';
        fullscreenPlayIcon.className = 'fas fa-play';
        nowPlayingCover.classList.remove('playing');
        fullscreenCover.classList.remove('playing');
    }
}

function getNextSong() {
    var playlist = [];
    if (currentPage === 'favorites') playlist = favorites;
    else if (currentPage === 'history') playlist = playHistory.map(function(record) { return record.song; });
    else if (currentPage === 'playlistDetail' && currentPlaylistId) { var pl = findPlaylist(currentPlaylistId); if (pl) playlist = pl.songs; }
    else playlist = currentSongs;
    if (playlist.length === 0) return null;
    if (settings.playMode === 'random') {
        var randomIndex;
        do { randomIndex = Math.floor(Math.random() * playlist.length); } while (playlist.length > 1 && randomIndex === currentIndex);
        return { song: playlist[randomIndex], index: randomIndex };
    } else {
        var newIndex = currentIndex + 1;
        if (newIndex >= playlist.length) newIndex = 0;
        return { song: playlist[newIndex], index: newIndex };
    }
}

function getPrevSong() {
    var playlist = [];
    if (currentPage === 'favorites') playlist = favorites;
    else if (currentPage === 'history') playlist = playHistory.map(function(record) { return record.song; });
    else if (currentPage === 'playlistDetail' && currentPlaylistId) { var pl = findPlaylist(currentPlaylistId); if (pl) playlist = pl.songs; }
    else playlist = currentSongs;
    if (playlist.length === 0) return null;
    if (settings.playMode === 'random') {
        var randomIndex;
        do { randomIndex = Math.floor(Math.random() * playlist.length); } while (playlist.length > 1 && randomIndex === currentIndex);
        return { song: playlist[randomIndex], index: randomIndex };
    } else {
        var newIndex = currentIndex - 1;
        if (newIndex < 0) newIndex = playlist.length - 1;
        return { song: playlist[newIndex], index: newIndex };
    }
}

// ============================================
// HD 大屏幕功能
// ============================================
function initHDFeature() {
    var hdBadge = document.getElementById('hdBadge');
    if (!hdBadge) return;
    function checkLargeScreen() {
        var isLarge = window.innerWidth >= 1100;
        hdBadge.style.display = isLarge ? 'inline-block' : 'none';
        return isLarge;
    }
    var isLarge = checkLargeScreen();
    window.addEventListener('resize', debounce(function() { isLarge = checkLargeScreen(); }, 150));
    hdBadge.addEventListener('click', function(e) {
        e.stopPropagation();
        if (isLarge) showHDModal();
    });
}

function showHDModal() {
    var hdModal = document.getElementById('hdModal');
    if (hdModal) { hdModal.classList.add('active'); return; }
    var modalHTML = '\n        <div class="modal hd-modal" id="hdModal">\n            <div class="modal-content">\n                <div class="modal-header">\n                    <h2 class="modal-title">大屏幕适配提示</h2>\n                    <button class="close-btn" id="closeHDModal"><i class="fas fa-times"></i></button>\n                </div>\n                <div style="text-align:center;padding:20px 0;">\n                    <i class="fas fa-desktop"></i>\n                    <h3>HD 大屏幕模式</h3>\n                    <p>您当前正在使用大屏幕设备，<br>Any Sound 已经对大屏幕做了全面适配！</p>\n                    <p style="font-size:12px;color:var(--text-secondary);">建议使用 1920x1080 或更高分辨率获得最佳体验</p>\n                    <button class="btn" id="hdModalConfirmBtn">我知道了</button>\n                </div>\n            </div>\n        </div>';
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    hdModal = document.getElementById('hdModal');
    var closeBtn = document.getElementById('closeHDModal');
    var confirmBtn = document.getElementById('hdModalConfirmBtn');
    function closeModal() {
        hdModal.classList.remove('active');
        setTimeout(function() { if (hdModal && hdModal.parentNode) hdModal.remove(); }, 300);
    }
    closeBtn.addEventListener('click', closeModal);
    confirmBtn.addEventListener('click', closeModal);
    hdModal.addEventListener('click', function(e) { if (e.target === hdModal) closeModal(); });
    setTimeout(function() { hdModal.classList.add('active'); }, 10);
}

// ============================================
// 3D 倾斜效果（仅桌面端）
// ============================================
function initTiltEffect() {
    var isDesktop = window.innerWidth >= 992;
    if (!isDesktop) return;
    bindTiltToCards();
    bindTiltToFullscreenCover();
    bindTiltToModals();
    document.addEventListener('animationend', function(e) {
        if (e.target.classList.contains('song-card') && e.animationName === 'cardFadeIn') {
            e.target.style.animation = 'none';
        }
    });
}

function bindTiltToCards() {
    var currentTiltCard = null;
    document.addEventListener('mouseover', function(e) {
        if (window.innerWidth < 992) return;
        var card = e.target.closest('.song-card');
        if (card && card !== currentTiltCard) {
            if (currentTiltCard) {
                currentTiltCard.classList.remove('tilt-active');
                currentTiltCard.style.transform = ''
            }
            currentTiltCard = card;
        }
    });
    document.addEventListener('mouseout', function(e) {
        var card = e.target.closest('.song-card');
        if (card && card === currentTiltCard) {
            var related = e.relatedTarget;
            if (related && card.contains(related)) return;
            card.classList.remove('tilt-active');
            card.style.transform = ''
            currentTiltCard = null;
        }
    });
    document.addEventListener('mousemove', function(e) {
        if (window.innerWidth < 992 || !currentTiltCard) return;
        currentTiltCard.classList.add('tilt-active');
        var rect = currentTiltCard.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;
        var centerX = rect.width / 2;
        var centerY = rect.height / 2;
        var rotateX = ((y - centerY) / centerY) * -8;
        var rotateY = ((x - centerX) / centerX) * 8;
        currentTiltCard.style.transform = 'perspective(600px) rotateX(' + rotateX + 'deg) rotateY(' + rotateY + 'deg) translateY(-4px)';
    });
}

function bindTiltToFullscreenCover() {
    if (!fullscreenCover) return;
    fullscreenCover.addEventListener('mousemove', function(e) {
        if (window.innerWidth < 992) return;
        fullscreenCover.classList.add('tilt-active');
        var rect = fullscreenCover.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;
        var centerX = rect.width / 2;
        var centerY = rect.height / 2;
        var rotateX = ((y - centerY) / centerY) * -12;
        var rotateY = ((x - centerX) / centerX) * 12;
        fullscreenCover.style.transform = 'perspective(500px) rotateX(' + rotateX + 'deg) rotateY(' + rotateY + 'deg)';
    });
    fullscreenCover.addEventListener('mouseleave', function() {
        fullscreenCover.classList.remove('tilt-active');
        fullscreenCover.style.transform = ''
    });
}

function bindTiltToModals() {
    document.addEventListener('mousemove', function(e) {
        if (window.innerWidth < 992) return;
        var allModals = document.querySelectorAll('.modal.active');
        var activeModal = allModals.length > 0 ? allModals[allModals.length - 1] : null;
        if (!activeModal) return;
        var modalContent = activeModal.querySelector('.modal-content');
        if (!modalContent) return;
        var rect = modalContent.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;
        if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
            modalContent.classList.remove('tilt-active');
            modalContent.style.transform = '';
            return;
        }
        modalContent.classList.add('tilt-active');
        var centerX = rect.width / 2;
        var centerY = rect.height / 2;
        var rotateX = ((y - centerY) / centerY) * -6;
        var rotateY = ((x - centerX) / centerX) * 6;
        modalContent.style.transform = 'perspective(800px) rotateX(' + rotateX + 'deg) rotateY(' + rotateY + 'deg) scale(1)';
    });
}

// ============================================
// 公告
// ============================================
function checkAndShowAnnouncement() {
    var lastKey = 'anyListen_lastAnnouncement';
    var noShowKey = 'anyListen_noShowAnnouncement';
    var stored = localStorage.getItem(lastKey);
    var noShow = localStorage.getItem(noShowKey) === 'true';
    if (stored !== ANNOUNCEMENT_CONTENT) {
        if (noShow) localStorage.removeItem(noShowKey);
        showAnnouncementModal();
        localStorage.setItem(lastKey, ANNOUNCEMENT_CONTENT);
    } else if (!noShow && !announcementShownThisSession) {
        showAnnouncementModal();
    }
}

function showAnnouncementModal() {
    var modal = document.getElementById('announcementModal');
    var contentDiv = document.getElementById('announcementContent');
    if (!modal || !contentDiv) return;
    contentDiv.innerHTML = ANNOUNCEMENT_CONTENT.replace(/\n/g, '<br>');
    modal.classList.add('active');
    announcementShownThisSession = true;
    var closeBtn = document.getElementById('closeAnnouncementModal');
    var confirmBtn = document.getElementById('confirmAnnouncementBtn');
    var dontShowCheck = document.getElementById('dontShowAgainCheckbox');
    var closeHandler = function() {
        modal.classList.remove('active');
        if (dontShowCheck && dontShowCheck.checked) {
            localStorage.setItem('anyListen_noShowAnnouncement', 'true');
        }
        closeBtn.removeEventListener('click', closeHandler);
        confirmBtn.removeEventListener('click', closeHandler);
    };
    closeBtn.addEventListener('click', closeHandler);
    confirmBtn.addEventListener('click', closeHandler);
}

function checkVersion(isManual) {
    var btn = document.getElementById('checkUpdateBtn');
    if (btn && isManual) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 检查中...';
    }
    fetch('version.json?t=' + Date.now())
        .then(function(res) {
            if (!res.ok) throw new Error('网络错误');
            return res.json();
        })
        .then(function(data) {
            if (!data || !data.version) return;
            if (data.version !== APP_VERSION) {
                showUpdateModal(data.version);
            } else if (isManual) {
                showToast('已是最新版本 ' + APP_VERSION, 'success');
            }
        })
        .catch(function() {
            if (isManual) showToast('检查更新失败，请检查网络', 'error');
        })
        .finally(function() {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-sync-alt"></i> 检查更新';
            }
        });
}

function showUpdateModal(serverVersion) {
    var overlay = document.createElement('div');
    overlay.className = 'update-modal-overlay';
    overlay.id = 'updateModalOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:10001;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.25s ease;';

    var dialog = document.createElement('div');
    dialog.style.cssText = 'background:rgba(23,23,23,0.95);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,0.12);border-radius:20px;padding:32px;max-width:420px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.5);animation:fadeUp 0.35s cubic-bezier(0.4,0,0.2,1);';

    dialog.innerHTML = '<div style="font-size:48px;margin-bottom:12px;">🎉</div>' +
        '<h3 style="margin:0 0 8px;font-size:20px;color:#fff;font-weight:700;">发现新版本</h3>' +
        '<p style="margin:0 0 4px;font-size:14px;color:rgba(255,255,255,0.5);">当前版本 ' + APP_VERSION + '</p>' +
        '<p style="margin:0 0 24px;font-size:16px;color:#a78bfa;font-weight:600;">最新版本 ' + serverVersion + '</p>' +
        '<div style="display:flex;gap:12px;justify-content:center;">' +
        '<button class="update-modal-cancel" style="padding:10px 24px;border:1px solid rgba(255,255,255,0.15);border-radius:12px;background:transparent;color:rgba(255,255,255,0.6);font-size:14px;cursor:pointer;transition:all 0.2s;font-family:inherit;">稍后更新</button>' +
        '<button class="update-modal-confirm" style="padding:10px 24px;border:none;border-radius:12px;background:linear-gradient(135deg, #7c3aed, #a855f7);color:#fff;font-size:14px;font-weight:600;cursor:pointer;transition:all 0.2s;font-family:inherit;">立即更新</button>' +
        '</div>';

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    function closeAndReload() {
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.2s ease';
        setTimeout(function() {
            overlay.remove();
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({ action: 'clearCache' });
            }
            if ('caches' in window) {
                caches.keys().then(function(keys) {
                    keys.forEach(function(key) { caches.delete(key); });
                }).finally(function() {
                    window.location.reload(true);
                });
            } else {
                window.location.reload(true);
            }
        }, 200);
    }

    dialog.querySelector('.update-modal-confirm').addEventListener('click', closeAndReload);
    dialog.querySelector('.update-modal-cancel').addEventListener('click', function() {
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.2s ease';
        setTimeout(function() { overlay.remove(); }, 200);
    });

    dialog.querySelector('.update-modal-cancel').addEventListener('mouseenter', function() {
        this.style.background = 'rgba(255,255,255,0.08)';
        this.style.color = 'rgba(255,255,255,0.8)';
    });
    dialog.querySelector('.update-modal-cancel').addEventListener('mouseleave', function() {
        this.style.background = 'transparent';
        this.style.color = 'rgba(255,255,255,0.6)';
    });
    dialog.querySelector('.update-modal-confirm').addEventListener('mouseenter', function() {
        this.style.background = 'linear-gradient(135deg, #6d28d9, #9333ea)';
    });
    dialog.querySelector('.update-modal-confirm').addEventListener('mouseleave', function() {
        this.style.background = 'linear-gradient(135deg, #7c3aed, #a855f7)';
    });
}

// ============================================
// 初始化
// ============================================
function init() {
    originalTitle = document.title;
    loadUserData();
    loadSettings();
    loadFavorites();
    loadPlayHistory();
    loadLastPlaybackState();
    loadLastPagePosition();
    loadSearchHistory();
    audioPlayer.crossOrigin = "anonymous";
    updateLoginUI();
    updateFavoritesCount();
    updateHistoryCount();
    updateFavoritesPage();
    updateHistoryPage();
    updateSettingsPage();
    initFullscreenSettings();
    audioPlayer.volume = volume;
    updateVolumeUI();
    bindEvents();
    autoRestorePlayback();
    loadHotSongsForHome();
    handleResize();
    updatePlayModeUI();
    addPlayerModeButton();
    createUserProfileModal();
    bindChartTabs();
    initBufferProgress();
    addRandomMusicButton();
    initHDFeature();
    initTiltEffect();
    loadPlaylists();
    initKeyboardShortcuts();
    if (settings.sleepTimer > 0) { startSleepTimer(settings.sleepTimer); }
    if (settings.superPerformance) { applySuperPerformance(); } else { startFPSMonitor(); }
    applyShowFPS();
    applyFloatingLyricsStyle();
    checkDevMode();
    applyDisableAnimations();
    applyShowBounds();
    applyLiquidGlass();
    checkAndShowAnnouncement();
    checkVersion();
    updatePlatformButtons(currentPlatform);
    var aboutTermsLink = document.getElementById('aboutTermsLink');
    if (aboutTermsLink) {
        aboutTermsLink.addEventListener('click', function(e) {
            e.preventDefault();
            document.getElementById('aboutModal').classList.remove('active');
            document.getElementById('termsModal').classList.add('active');
        });
    }
    var aboutModal = document.getElementById('aboutModal');
    var closeAboutModal = document.getElementById('closeAboutModal');
    var aboutNavBtn = document.getElementById('aboutNavBtn');
    var checkUpdateBtn = document.getElementById('checkUpdateBtn');
    if (checkUpdateBtn) {
        checkUpdateBtn.addEventListener('click', function() {
            checkVersion(true);
        });
    }
    if (aboutNavBtn) {
        aboutNavBtn.addEventListener('click', function(e) {
            e.preventDefault();
            aboutModal.classList.add('active');
            closeMobileSidebar();
        });
    }
    if (closeAboutModal) {
        closeAboutModal.addEventListener('click', function() { aboutModal.classList.remove('active'); });
    }
    if (aboutModal) {
        aboutModal.addEventListener('click', function(e) {
            if (e.target === aboutModal) aboutModal.classList.remove('active');
        });
    }
    var devClickCount = 5;
    var aboutVersion = document.getElementById('aboutVersion');
    if (aboutVersion) {
        aboutVersion.style.cursor = 'pointer';
        aboutVersion.addEventListener('click', function(e) {
            e.stopPropagation();
            if (settings.devMode) {
                showToast('您已经处于开发者模式，在开发者模态窗里可以关闭开发者模式', 'info', 1500);
                return;
            }
            devClickCount--;
            showToast('再点击 ' + devClickCount + ' 次开启开发者模式', 'info', 600);
            if (devClickCount <= 0) {
                showDevModeWarning();
                devClickCount = 5;
            }
        });
    }
    var devOptionsModal = document.getElementById('devOptionsModal');
    var devOptionsBtn = document.getElementById('devOptionsBtn');
    var closeDevOptionsModal = document.getElementById('closeDevOptionsModal');
    var devOptionsCloseBtn = document.getElementById('devOptionsCloseBtn');
    if (devOptionsBtn) {
        devOptionsBtn.addEventListener('click', function() {
            updateDevOptionsPage();
            devOptionsModal.classList.add('active');
        });
    }
    if (closeDevOptionsModal) {
        closeDevOptionsModal.addEventListener('click', function() { devOptionsModal.classList.remove('active'); });
    }
    if (devOptionsCloseBtn) {
        devOptionsCloseBtn.addEventListener('click', function() { devOptionsModal.classList.remove('active'); });
    }
    if (devOptionsModal) {
        devOptionsModal.addEventListener('click', function(e) {
            if (e.target === devOptionsModal) devOptionsModal.classList.remove('active');
        });
    }
    closeSettingsModal.addEventListener('click', function() { settingsModal.classList.remove('active'); });
    settingsCloseBtn.addEventListener('click', function() { settingsModal.classList.remove('active'); });
    settingsNavBtn.addEventListener('click', function(e) {
        e.preventDefault();
        var isAndroidMobile = document.body.classList.contains('mobile-android-style');
        if (isAndroidMobile) {
            switchPage('settings');
        } else {
            settingsModal.classList.add('active');
            updateSettingsPage();
            checkDevMode();
        }
        closeMobileSidebar();
    });

    // 播放列表事件绑定
    var createPlaylistBtn = document.getElementById('createPlaylistBtn');
    if (createPlaylistBtn) createPlaylistBtn.addEventListener('click', function() { showPlaylistModal('create'); });
    var editPlaylistsBtn = document.getElementById('editPlaylistsBtn');
    if (editPlaylistsBtn) editPlaylistsBtn.addEventListener('click', togglePlaylistEditMode);
    var backToPlaylistsBtn = document.getElementById('backToPlaylistsBtn');
    if (backToPlaylistsBtn) backToPlaylistsBtn.addEventListener('click', function() { currentPlaylistId = null; switchPage('playlists'); });
    var backFromSettingsBtn = document.getElementById('backFromSettingsBtn');
    if (backFromSettingsBtn) backFromSettingsBtn.addEventListener('click', function() {
        switchPage('home');
    });
    var renamePlaylistBtn = document.getElementById('renamePlaylistBtn');
    if (renamePlaylistBtn) renamePlaylistBtn.addEventListener('click', function() { showPlaylistModal('rename', currentPlaylistId); });
    var deletePlaylistBtn = document.getElementById('deletePlaylistBtn');
    if (deletePlaylistBtn) deletePlaylistBtn.addEventListener('click', function() { if (confirm('确定要删除这个歌单吗？')) deletePlaylist(currentPlaylistId); });
    var editPlaylistSongsBtn = document.getElementById('editPlaylistSongsBtn');
    if (editPlaylistSongsBtn) editPlaylistSongsBtn.addEventListener('click', togglePlaylistSongsEditMode);
    var closePlaylistModalBtn = document.getElementById('closePlaylistModal');
    if (closePlaylistModalBtn) closePlaylistModalBtn.addEventListener('click', hidePlaylistModal);
    if (playlistModal) playlistModal.addEventListener('click', function(e) { if (e.target === playlistModal) hidePlaylistModal(); });
    var confirmPlaylistBtn = document.getElementById('confirmPlaylistBtn');
    if (confirmPlaylistBtn) confirmPlaylistBtn.addEventListener('click', confirmPlaylistAction);
    var cancelPlaylistBtn = document.getElementById('cancelPlaylistBtn');
    if (cancelPlaylistBtn) cancelPlaylistBtn.addEventListener('click', hidePlaylistModal);
    playlistNameInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') confirmPlaylistAction(); });
    var closeAddToPlaylistBtn = document.getElementById('closeAddToPlaylistModal');
    if (closeAddToPlaylistBtn) closeAddToPlaylistBtn.addEventListener('click', hideAddToPlaylistModal);
    if (addToPlaylistModal) addToPlaylistModal.addEventListener('click', function(e) { if (e.target === addToPlaylistModal) hideAddToPlaylistModal(); });
    var cancelSleepTimerBtn = document.getElementById('cancelSleepTimer');
    if (cancelSleepTimerBtn) cancelSleepTimerBtn.addEventListener('click', function() { cancelSleepTimer(); showToast('睡眠定时已取消', 'info'); });
    if (navSearchInput) {
        navSearchInput.addEventListener('focus', showNavSearchDropdown);
        navSearchInput.addEventListener('blur', function() { setTimeout(hideNavSearchDropdown, 300); });
        navSearchInput.addEventListener('keypress', function(e) { if (e.key === 'Enter') performNavSearch(); });
    }
    if (navSearchBtn) navSearchBtn.addEventListener('click', performNavSearch);
    if (clearSearchHistoryBtn) clearSearchHistoryBtn.addEventListener('click', clearSearchHistoryAll);
    if (mobileClearSearchHistoryBtn) mobileClearSearchHistoryBtn.addEventListener('click', clearSearchHistoryAll);
    if (searchInput) {
        searchInput.addEventListener('focus', function() { if (window.innerWidth <= 992) showMobileSearchHistory(); });
        searchInput.addEventListener('blur', function() { setTimeout(hideMobileSearchHistory, 300); });
    }
    if (refreshHistoryBtn) refreshHistoryBtn.addEventListener('click', function() { updateHistoryPage(); showToast('历史已刷新', 'success'); });
    history.replaceState({ page: 'home' }, '', window.location.href);
    window.addEventListener('popstate', function(e) {
        var page = (e.state && e.state.page) ? e.state.page : 'home';
        _isPoppingState = true;
        switchPage(page);
        _isPoppingState = false;
    });
    console.log('Any Sound 初始化完成 v26.24.5');
    setTimeout(function() { hidePageLoader(); }, 10000);
}

function initBufferProgress() {
    var bufferEl = document.createElement('div');
    bufferEl.className = 'buffer-progress';
    bufferEl.id = 'bufferProgress';
    progressBar.appendChild(bufferEl);
    var fullBufferEl = document.createElement('div');
    fullBufferEl.className = 'buffer-progress';
    fullBufferEl.id = 'fullscreenBufferProgress';
    fullscreenProgressBar.appendChild(fullBufferEl);
    audioPlayer.addEventListener('progress', updateBufferProgress);
    audioPlayer.addEventListener('loadedmetadata', updateBufferProgress);
    audioPlayer.addEventListener('canplay', updateBufferProgress);
    audioPlayer.addEventListener('canplaythrough', updateBufferProgress);
    audioPlayer.addEventListener('waiting', function() {
        var b = document.getElementById('bufferProgress');
        var fb = document.getElementById('fullscreenBufferProgress');
        if (b) b.classList.add('loading');
        if (fb) fb.classList.add('loading');
    });
    audioPlayer.addEventListener('playing', function() {
        var b = document.getElementById('bufferProgress');
        var fb = document.getElementById('fullscreenBufferProgress');
        if (b) b.classList.remove('loading');
        if (fb) fb.classList.remove('loading');
    });
    audioPlayer.addEventListener('play', function() {
        startLyricsRaf();
        if (settings.floatingLyricsEnabled && floatingLyrics && lyricsData.length > 0) { floatingLyrics.classList.add('visible'); var topv = settings.floatingLyricsOpacity !== undefined ? settings.floatingLyricsOpacity : 100; floatingLyrics.style.opacity = (topv / 100).toString(); applyFloatingLyricsStyle(); }
    });
    audioPlayer.addEventListener('pause', function() {
        stopLyricsRaf();
        if (floatingLyrics) { floatingLyrics.classList.remove('visible'); floatingLyrics.style.opacity = '0'; }
    });
}

function updateBufferProgress() {
    var bufferEl = document.getElementById('bufferProgress');
    var fullBufferEl = document.getElementById('fullscreenBufferProgress');
    if (audioPlayer.buffered && audioPlayer.buffered.length > 0 && audioPlayer.duration) {
        var bufferedEnd = audioPlayer.buffered.end(audioPlayer.buffered.length - 1);
        var percent = (bufferedEnd / audioPlayer.duration) * 100;
        if (bufferEl) { bufferEl.style.width = percent + '%'; if (percent >= 99) bufferEl.classList.remove('loading'); }
        if (fullBufferEl) { fullBufferEl.style.width = percent + '%'; if (percent >= 99) fullBufferEl.classList.remove('loading'); }
    }
}

function addRandomMusicButton() {
    var navSections = sidebar.querySelectorAll('.nav-section');
    var browseSection = null;
    navSections.forEach(function(section) {
        var title = section.querySelector('.section-title');
        if (title && title.textContent.trim() === '浏览') browseSection = section;
    });
    if (!browseSection) return;
    var randomNavItem = document.createElement('a');
    randomNavItem.href = '#';
    randomNavItem.className = 'nav-item random-music-btn';
    randomNavItem.setAttribute('data-page', 'random');
    randomNavItem.innerHTML = '<div class="nav-icon"><i class="fas fa-random"></i></div><div class="nav-text">随机来一首</div>';
    var discoverItem = browseSection.querySelector('.nav-item[data-page="home"]');
    if (discoverItem && discoverItem.nextSibling) {
        browseSection.insertBefore(randomNavItem, discoverItem.nextSibling);
    } else {
        browseSection.appendChild(randomNavItem);
    }
    randomNavItem.addEventListener('click', async function(e) {
        e.preventDefault();
        await playRandomMusic();
    });
}

async function playRandomMusic() {
    try {
        showToast('正在获取随机音乐...', 'info');
        var response = await fetch('https://node.api.xfabe.com/api/wangyi/randomMusic?type=json');
        if (!response.ok) throw new Error('获取随机音乐失败');
        var data = await response.json();
        if (data.code !== 200 || !data.data) throw new Error('未获取到随机音乐数据');
        var song = data.data;
        var formattedSong = {
            id: song.id,
            name: song.name,
            artistsname: song.artistsname,
            album: song.album || '',
            picurl: ensureHttpsUrl(song.picurl || ''),
            duration: song.duration || 0,
            platform: 'netease',
            pay: song.pay || ''
        };
        try {
            var coverUrl = await getHighQualityCover(song.id);
            if (coverUrl) formattedSong.picurl = ensureHttpsUrl(coverUrl);
        } catch (e) {}
        currentSongs = [formattedSong];
        if (currentPlatform !== 'all') updatePlatformButtons('netease');
        await playSong(formattedSong, 0);
        showToast('随机播放: ' + song.name + ' - ' + song.artistsname, 'success');
    } catch (error) {
        console.error('随机音乐获取错误:', error);
        showToast('随机播放失败，请重试', 'error');
    }
}

// ============================================
// 事件绑定
// ============================================
function bindEvents() {
    hamburgerMenu.addEventListener('click', toggleMobileMenu);
    overlay.addEventListener('click', closeMobileSidebar);
    sidebarToggleDesktop.addEventListener('click', toggleDesktopSidebar);
    themeToggle.addEventListener('click', toggleTheme);
    navItems.forEach(function(item) {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            var page = item.dataset.page;
            if (page) {
                switchPage(page);
                setActiveNav(item);
                closeMobileSidebar();
            }
        });
    });
    donationBtn.addEventListener('click', function(e) { e.preventDefault(); donationModal.classList.add('active'); closeMobileSidebar(); });
    closeDonationModal.addEventListener('click', function() { donationModal.classList.remove('active'); });
    downloadAppBtn.addEventListener('click', function(e) { e.preventDefault(); openDownloadAppModal(); closeMobileSidebar(); });
    closeDownloadAppModal.addEventListener('click', closeDownloadAppModalHandler);
    termsLink.addEventListener('click', function(e) { e.preventDefault(); termsModal.classList.add('active'); loginModal.classList.remove('active'); });
    closeTermsModal.addEventListener('click', function() { termsModal.classList.remove('active'); });
    closeTermsBtn.addEventListener('click', function() {
        if (modalTermsAgreement.checked) { termsModal.classList.remove('active'); if (loginModal.classList.contains('active')) loginModal.classList.add('active'); }
        else showToast('请先同意使用条款', 'warning');
    });
    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', function(e) { if (e.key === 'Enter') performSearch(); });

    // 平台按钮事件（包括桌面和移动端所有 .platform-btn）
    var allPlatformBtns = document.querySelectorAll('.platform-btn');
    allPlatformBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
            var platform = btn.dataset.platform;
            if (platform !== currentPlatform) {
                updatePlatformButtons(platform);
                showToast('已切换到' + (platform === 'netease' ? '网易云音乐' : '酷我音乐'), 'info');
                if (searchInput.value.trim() && currentPage === 'search') {
                    performSearch();
                }
            }
        });
    });

    // 桌面端平台下拉事件
    var platformDropdown = document.getElementById('platformDropdown');
    var platformDropdownBtn = document.getElementById('platformDropdownBtn');
    var platformDropdownMenu = document.getElementById('platformDropdownMenu');
    if (platformDropdownBtn) {
        platformDropdownBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            platformDropdown.classList.toggle('open');
        });
    }
    var platformDropdownItems = document.querySelectorAll('.platform-dropdown-item');
    platformDropdownItems.forEach(function(item) {
        item.addEventListener('click', function() {
            var platform = item.dataset.platform;
            if (platform !== currentPlatform) {
                updatePlatformButtons(platform);
                var name = platform === 'netease' ? '网易云音乐' : (platform === 'kuwo' ? '酷我音乐' : '聚合搜索');
                showToast('已切换到' + name, 'info');
                if (searchInput.value.trim() && currentPage === 'search') {
                    performSearch();
                }
            }
            platformDropdown.classList.remove('open');
        });
    });
    document.addEventListener('click', function(e) {
        if (platformDropdown && !platformDropdown.contains(e.target)) {
            platformDropdown.classList.remove('open');
        }
    });

    var mobilePlatformDropdown = document.getElementById('mobilePlatformDropdown');
    var mobilePlatformDropdownBtn = document.getElementById('mobilePlatformDropdownBtn');
    var mobilePlatformDropdownMenu = document.getElementById('mobilePlatformDropdownMenu');
    if (mobilePlatformDropdownBtn) {
        mobilePlatformDropdownBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            mobilePlatformDropdown.classList.toggle('open');
        });
    }
    var mobilePlatformDropdownItems = mobilePlatformDropdownMenu ? mobilePlatformDropdownMenu.querySelectorAll('.platform-dropdown-item') : [];
    mobilePlatformDropdownItems.forEach(function(item) {
        item.addEventListener('click', function() {
            var platform = item.dataset.platform;
            if (platform !== currentPlatform) {
                updatePlatformButtons(platform);
                var name = platform === 'netease' ? '网易云音乐' : (platform === 'kuwo' ? '酷我音乐' : '聚合搜索');
                showToast('已切换到' + name, 'info');
                if (searchInput.value.trim() && currentPage === 'search') {
                    performSearch();
                }
            }
            mobilePlatformDropdown.classList.remove('open');
        });
    });
    document.addEventListener('click', function(e) {
        if (mobilePlatformDropdown && !mobilePlatformDropdown.contains(e.target)) {
            mobilePlatformDropdown.classList.remove('open');
        }
    });

    closeLoginModal.addEventListener('click', function() { loginModal.classList.remove('active'); hideAuthError(); });
    loginTabBtn.addEventListener('click', function() { loginTabBtn.classList.add('active'); registerTabBtn.classList.remove('active'); loginForm.style.display = 'block'; registerForm.style.display = 'none'; hideAuthError(); });
    registerTabBtn.addEventListener('click', function() { registerTabBtn.classList.add('active'); loginTabBtn.classList.remove('active'); loginForm.style.display = 'none'; registerForm.style.display = 'block'; hideAuthError(); });
    loginBtn.addEventListener('click', handleLogin);
    registerBtn.addEventListener('click', handleRegister);
    closeAccountSettingsModal.addEventListener('click', function() { accountSettingsModal.classList.remove('active'); hideAccountError(); });
    updateAccountBtn.addEventListener('click', handleUpdateAccount);
    userSettingsItem.addEventListener('click', function() { userMenu.classList.remove('active'); openAccountSettings(); });
    exportAccountDataBtn.addEventListener('click', exportAccountData);
    importAccountDataBtn.addEventListener('click', function() { importAccountDataFile.click(); });
    importAccountDataFile.addEventListener('change', handleImportAccountData);
    deleteAccountBtn.addEventListener('click', handleDeleteAccount);
    playPauseBtn.addEventListener('click', togglePlayPause);
    prevBtn.addEventListener('click', function() {
        coverTransitionDirection = 'prev';
        if (settings.crossfade && audioPlayer.src && currentSongs.length > 0) {
            var prev = getPrevSong();
            if (prev) crossfadeSwitch(prev.song, prev.index);
            else playPrev();
        } else playPrev();
    });
    nextBtn.addEventListener('click', function() {
        coverTransitionDirection = 'next';
        if (settings.crossfade && audioPlayer.src && currentSongs.length > 0) {
            var next = getNextSong();
            if (next) crossfadeSwitch(next.song, next.index);
            else playNext();
        } else playNext();
    });
    audioPlayer.addEventListener('loadedmetadata', updateDuration);
    audioPlayer.addEventListener('timeupdate', updateProgress);
    audioPlayer.addEventListener('ended', handleSongEnd);
    audioPlayer.addEventListener('error', handleAudioError);

    var isDraggingVolume = false;
    var volumeRAFId = null;
    var volumeSliderRect = null;
    var prevVolume = volume;
    function updateVolumeFromEvent(e) {
        var clientY = e.touches ? e.touches[0].clientY : e.clientY;
        if (!volumeSliderRect) volumeSliderRect = volumeSlider.getBoundingClientRect();
        var percent = Math.max(0, Math.min(1, 1 - (clientY - volumeSliderRect.top) / volumeSliderRect.height));
        volume = percent;
        audioPlayer.volume = volume;
        updateVolumeUI();
        showDragTooltip(e.clientX || (e.touches && e.touches[0].clientX), volumeSliderRect.top - 10, '音量 ' + Math.round(percent * 100) + '%');
    }
    function onVolumeMove(e) { if (!isDraggingVolume) return; e.preventDefault(); if (volumeRAFId) return; volumeRAFId = requestAnimationFrame(function() { volumeRAFId = null; updateVolumeFromEvent(e); }); }
    function startVolumeDrag(e) { e.preventDefault(); isDraggingVolume = true; document.body.classList.add('dragging'); volumeSliderRect = volumeSlider.getBoundingClientRect(); updateVolumeFromEvent(e); document.addEventListener('mousemove', onVolumeMove); document.addEventListener('mouseup', stopVolumeDrag); document.addEventListener('touchmove', onVolumeMove, { passive: false }); document.addEventListener('touchend', stopVolumeDrag); }
    function stopVolumeDrag() { isDraggingVolume = false; document.body.classList.remove('dragging'); volumeSliderRect = null; if (volumeRAFId) { cancelAnimationFrame(volumeRAFId); volumeRAFId = null; } document.removeEventListener('mousemove', onVolumeMove); document.removeEventListener('mouseup', stopVolumeDrag); document.removeEventListener('touchmove', onVolumeMove); document.removeEventListener('touchend', stopVolumeDrag); hideDragTooltip(); }
    volumeSlider.addEventListener('mousedown', startVolumeDrag);
    volumeSlider.addEventListener('touchstart', startVolumeDrag);

    function isTouchDevice() { return 'ontouchstart' in window || navigator.maxTouchPoints > 0; }
    volumeBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (isTouchDevice()) {
            volumeBtnWrapper.classList.toggle('volume-open');
        } else {
            if (volume > 0) {
                prevVolume = volume;
                audioPlayer.volume = 0;
                volume = 0;
            } else {
                var restore = prevVolume > 0 ? prevVolume : 0.5;
                audioPlayer.volume = restore;
                volume = restore;
            }
            updateVolumeUI();
        }
    });
    document.addEventListener('click', function(e) {
        if (!volumeBtnWrapper.contains(e.target)) {
            volumeBtnWrapper.classList.remove('volume-open');
        }
    });

    var isDraggingProgress = false;
    var progressRAFId = null;
    var progressBarRect = null;
    function updateProgressFromEvent(e) {
        if (!audioPlayer.duration) return;
        var clientX = e.touches ? e.touches[0].clientX : e.clientX;
        if (!progressBarRect) progressBarRect = progressBar.getBoundingClientRect();
        var percent = Math.max(0, Math.min(1, (clientX - progressBarRect.left) / progressBarRect.width));
        var newTime = percent * audioPlayer.duration;
        audioPlayer.currentTime = newTime;
        var timeStr = formatTime(newTime);
        var remaining = audioPlayer.duration - newTime;
        showDragTooltip(clientX, progressBarRect.top - 10, timeStr + ' / -' + formatTime(remaining));
    }
    function onProgressMove(e) { if (!isDraggingProgress) return; e.preventDefault(); if (progressRAFId) return; progressRAFId = requestAnimationFrame(function() { progressRAFId = null; updateProgressFromEvent(e); }); }
    function startProgressDrag(e) { e.preventDefault(); isDraggingProgress = true; document.body.classList.add('dragging'); progressBarRect = progressBar.getBoundingClientRect(); updateProgressFromEvent(e); document.addEventListener('mousemove', onProgressMove); document.addEventListener('mouseup', stopProgressDrag); document.addEventListener('touchmove', onProgressMove, { passive: false }); document.addEventListener('touchend', stopProgressDrag); }
    function stopProgressDrag() { isDraggingProgress = false; document.body.classList.remove('dragging'); progressBarRect = null; if (progressRAFId) { cancelAnimationFrame(progressRAFId); progressRAFId = null; } document.removeEventListener('mousemove', onProgressMove); document.removeEventListener('mouseup', stopProgressDrag); document.removeEventListener('touchmove', onProgressMove); document.removeEventListener('touchend', stopProgressDrag); hideDragTooltip(); }
    progressBar.addEventListener('mousedown', startProgressDrag);
    progressBar.addEventListener('touchstart', startProgressDrag);

    var isDraggingFullProgress = false;
    var fullProgressRAFId = null;
    var fullProgressBarRect = null;
    function updateFullProgressFromEvent(e) {
        if (!audioPlayer.duration) return;
        var clientX = e.touches ? e.touches[0].clientX : e.clientX;
        if (!fullProgressBarRect) fullProgressBarRect = fullscreenProgressBar.getBoundingClientRect();
        var percent = Math.max(0, Math.min(1, (clientX - fullProgressBarRect.left) / fullProgressBarRect.width));
        var newTime = percent * audioPlayer.duration;
        audioPlayer.currentTime = newTime;
        var timeStr = formatTime(newTime);
        var remaining = audioPlayer.duration - newTime;
        showDragTooltip(clientX, fullProgressBarRect.top - 10, timeStr + ' / -' + formatTime(remaining));
    }
    function onFullProgressMove(e) { if (!isDraggingFullProgress) return; e.preventDefault(); if (fullProgressRAFId) return; fullProgressRAFId = requestAnimationFrame(function() { fullProgressRAFId = null; updateFullProgressFromEvent(e); }); }
    function startFullProgressDrag(e) { e.preventDefault(); isDraggingFullProgress = true; document.body.classList.add('dragging'); fullProgressBarRect = fullscreenProgressBar.getBoundingClientRect(); updateFullProgressFromEvent(e); document.addEventListener('mousemove', onFullProgressMove); document.addEventListener('mouseup', stopFullProgressDrag); document.addEventListener('touchmove', onFullProgressMove, { passive: false }); document.addEventListener('touchend', stopFullProgressDrag); }
    function stopFullProgressDrag() { isDraggingFullProgress = false; document.body.classList.remove('dragging'); fullProgressBarRect = null; if (fullProgressRAFId) { cancelAnimationFrame(fullProgressRAFId); fullProgressRAFId = null; } document.removeEventListener('mousemove', onFullProgressMove); document.removeEventListener('mouseup', stopFullProgressDrag); document.removeEventListener('touchmove', onFullProgressMove); document.removeEventListener('touchend', stopFullProgressDrag); hideDragTooltip(); }
    fullscreenProgressBar.addEventListener('mousedown', startFullProgressDrag);
    fullscreenProgressBar.addEventListener('touchstart', startFullProgressDrag);

    qualityButtons.forEach(function(btn) {
        btn.addEventListener('click', async function() {
            var previousQuality = currentQuality;
            var newQuality = btn.dataset.quality;
            if (newQuality === currentQuality) { closeQualityDropdown(); return; }
            qualityButtons.forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
            currentQuality = newQuality;
            updateQualityLabel();
            closeQualityDropdown();
            var song = currentSongs[currentIndex];
            if (currentIndex !== -1 && audioPlayer.src && song && (song.platform === 'netease' || currentPlatform === 'netease')) {
                try {
                    var currentTime = audioPlayer.currentTime;
                    var wasPlaying = isPlaying;
                    var audioUrl = await getAudioUrl(song.id, currentQuality, song.platform);
                    audioPlayer.src = audioUrl;
                    audioPlayer.onloadedmetadata = function() {
                        audioPlayer.currentTime = currentTime;
                        if (wasPlaying) {
                            audioPlayer.play().catch(function() {});
                        }
                        audioPlayer.onloadedmetadata = null;
                    };
                    showToast('已切换到' + qualityNames[currentQuality] + '，播放进度已保持', 'info');
                } catch (error) {
                    showToast('切换到' + qualityNames[currentQuality] + '失败', 'error');
                    currentQuality = previousQuality;
                    qualityButtons.forEach(function(b) { b.classList.toggle('active', b.dataset.quality === currentQuality); });
                    updateQualityLabel();
                }
            } else {
                showToast('已切换到' + qualityNames[currentQuality], 'info');
            }
        });
    });

    qualityDropdownBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        qualityDropdown.classList.toggle('open');
        qualityDropdownBtn.classList.toggle('open');
    });

    document.addEventListener('click', function(e) {
        if (!e.target.closest('.quality-selector')) {
            closeQualityDropdown();
        }
    });

    clearFavoritesBtn.addEventListener('click', clearFavorites);
    importFavoritesBtn.addEventListener('click', function() { importFavoritesFile.click(); });
    importFavoritesFile.addEventListener('change', handleImportFavorites);
    exportFavoritesBtn.addEventListener('click', exportFavorites);
    clearHistoryBtn.addEventListener('click', clearHistory);
    importHistoryBtn.addEventListener('click', function() { importHistoryFile.click(); });
    importHistoryFile.addEventListener('change', handleImportHistory);
    exportHistoryBtn.addEventListener('click', exportHistory);
    refreshTrendingBtn.addEventListener('click', loadHotSongsForHome);
    btnLoadTrending.addEventListener('click', loadHotSongsForHome);
    refreshHotlistBtn.addEventListener('click', function() { loadChartByType(currentChartType); });
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.user-avatar') && !e.target.closest('.user-menu')) userMenu.classList.remove('active');
    });
    userProfileItem.addEventListener('click', function() { userMenu.classList.remove('active'); openUserProfileModal(); });
    logoutItem.addEventListener('click', handleLogout);
    window.addEventListener('resize', debounce(handleResize, 150));
    document.addEventListener('keydown', handleKeyDown);
    nowPlayingCover.addEventListener('click', openFullscreenPlayer);
    fullscreenCover.addEventListener('click', closeFullscreenPlayer);
    fullscreenClose.addEventListener('click', closeFullscreenPlayer);
    if (fullscreenF11Btn) fullscreenF11Btn.addEventListener('click', function() {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            document.documentElement.requestFullscreen();
        }
    });
    document.addEventListener('fullscreenchange', function() {
        if (fullscreenF11Btn) {
            var icon = fullscreenF11Btn.querySelector('i');
            if (document.fullscreenElement) {
                icon.className = 'fas fa-compress';
            } else {
                icon.className = 'fas fa-expand';
            }
        }
    });
    fullscreenPlayBtn.addEventListener('click', togglePlayPause);
    fullscreenPrevBtn.addEventListener('click', function() {
        coverTransitionDirection = 'prev';
        if (settings.crossfade && audioPlayer.src && currentSongs.length > 0) {
            var prev = getPrevSong();
            if (prev) crossfadeSwitch(prev.song, prev.index);
            else playPrev();
        } else playPrev();
    });
    fullscreenNextBtn.addEventListener('click', function() {
        coverTransitionDirection = 'next';
        if (settings.crossfade && audioPlayer.src && currentSongs.length > 0) {
            var next = getNextSong();
            if (next) crossfadeSwitch(next.song, next.index);
            else playNext();
        } else playNext();
    });
    document.addEventListener('touchmove', function(e) { if (e.target.closest('.player-container')) e.preventDefault(); }, { passive: false });
    document.addEventListener('click', function(e) {
        if (window.innerWidth <= 992 && sidebar.classList.contains('active') && !e.target.closest('.sidebar') && !e.target.closest('.hamburger-menu')) {
            closeMobileSidebar();
        }
    });
    var scrollSaveTimer = null;
    mainContent.addEventListener('scroll', function() {
        if (!settings.rememberLastPosition) return;
        if (scrollSaveTimer) clearTimeout(scrollSaveTimer);
        scrollSaveTimer = setTimeout(function() {
            lastPagePosition = { page: currentPage, scrollTop: mainContent.scrollTop };
            localStorage.setItem('anyListenLastPagePosition', JSON.stringify(lastPagePosition));
        }, 300);
    });
    window.addEventListener('beforeunload', function() {
        saveLastPlaybackState();
        saveCurrentPagePosition();
        if (settings.dataBackup && isLoggedIn) {
            localStorage.setItem('anyListenAutoBackup', JSON.stringify({
                version: '26.24.5',
                backupDate: new Date().toISOString(),
                account: currentUser ? currentUser.username : '未知用户',
                favorites: favorites,
                playHistory: playHistory,
                settings: settings
            }));
            if (settings.backupFolderName) {
                getBackupHandle().then(function(handle) {
                    if (!handle) return;
                    verifyPermission(handle, true).then(function() {
                        var now = new Date();
                        var filename = 'anyListen_autobackup_' + now.getFullYear() + 
                            ('0' + (now.getMonth() + 1)).slice(-2) + 
                            ('0' + now.getDate()).slice(-2) + '_' +
                            ('0' + now.getHours()).slice(-2) + 
                            ('0' + now.getMinutes()).slice(-2) + '.json';
                        handle.getFileHandle(filename, { create: true }).then(function(fileHandle) {
                            fileHandle.createWritable().then(function(writable) {
                                writable.write(buildBackupData());
                                writable.close();
                            });
                        });
                    });
                }).catch(function() {});
            }
        }
    });
    if (fullscreenPlayer) {
        fullscreenPlayer.addEventListener('click', function(e) {
            if (window.innerWidth > 767) return;
            if (!settings.showLyrics) { showToast('歌词显示已关闭，请在设置中开启', 'info'); return; }
            if (e.target.closest('.mobile-back-btn') || e.target.closest('.fullscreen-close') ||
                e.target.closest('.fullscreen-ctrl-icon') || e.target.closest('.fullscreen-progress-bar')) return;
            fullscreenPlayer.classList.toggle('show-lyrics');
        });
    }
    if (mobileBackBtn) {
        mobileBackBtn.addEventListener('click', function(e) { e.stopPropagation(); fullscreenPlayer.classList.remove('show-lyrics'); });
    }
    if (fullscreenModeBtn) fullscreenModeBtn.addEventListener('click', togglePlayMode);
    if (fullscreenSettingsBtn) fullscreenSettingsBtn.addEventListener('click', function() { initFullscreenSettings(); fullscreenSettingsModal.classList.add('active'); });
    closeFullscreenSettingsModal.addEventListener('click', function() { fullscreenSettingsModal.classList.remove('active'); updateSettingsPage(); });
    fullscreenSettingsCloseBtn.addEventListener('click', function() { fullscreenSettingsModal.classList.remove('active'); updateSettingsPage(); });

    if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', function() { if (!audioPlayer.src) return; if (!isPlaying) togglePlayPause(); });
        navigator.mediaSession.setActionHandler('pause', function() { if (isPlaying) togglePlayPause(); });
        navigator.mediaSession.setActionHandler('previoustrack', function() {
            if (settings.crossfade && audioPlayer.src && currentSongs.length > 0) {
                var prev = getPrevSong();
                if (prev) crossfadeSwitch(prev.song, prev.index);
                else playPrev();
            } else playPrev();
        });
        navigator.mediaSession.setActionHandler('nexttrack', function() {
            if (settings.crossfade && audioPlayer.src && currentSongs.length > 0) {
                var next = getNextSong();
                if (next) crossfadeSwitch(next.song, next.index);
                else playNext();
            } else playNext();
        });
        navigator.mediaSession.setActionHandler('stop', function() {
            if (isPlaying) { audioPlayer.pause(); isPlaying = false; playIcon.className = 'fas fa-play'; fullscreenPlayIcon.className = 'fas fa-play'; nowPlayingCover.classList.remove('playing'); fullscreenCover.classList.remove('playing'); updateMediaSessionPlaybackState(); resetPageTitle(); }
        });
        navigator.mediaSession.setActionHandler('seekto', function(details) { if (details.seekTime !== undefined && audioPlayer.duration) audioPlayer.currentTime = details.seekTime; });
    }
}

function bindChartTabs() {
    document.querySelectorAll('.chart-tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
            var type = tab.dataset.type;
            if (type && type !== currentChartType) loadChartByType(type);
        });
    });
}

function initFullscreenSettings() {
    var html = '\n        <div class="setting-item"><div class="setting-info"><div class="setting-name">暗色主题</div></div><label class="toggle-switch"><input type="checkbox" id="fsDarkTheme" ' + (settings.darkTheme ? 'checked' : '') + '><span class="toggle-slider"></span></label></div>\n        <div class="setting-item"><div class="setting-info"><div class="setting-name">动画效果</div></div><label class="toggle-switch"><input type="checkbox" id="fsAnimation" ' + (settings.animations ? 'checked' : '') + '><span class="toggle-slider"></span></label></div>\n        <div class="setting-item"><div class="setting-info"><div class="setting-name">超性能模式</div></div><label class="toggle-switch"><input type="checkbox" id="fsSuperPerformance" ' + (settings.superPerformance ? 'checked' : '') + '><span class="toggle-slider"></span></label></div>\n        <div class="setting-item"><div class="setting-info"><div class="setting-name">封面旋转</div></div><label class="toggle-switch"><input type="checkbox" id="fsCoverRotation" ' + (settings.coverRotation ? 'checked' : '') + '><span class="toggle-slider"></span></label></div>\n        <div class="setting-item"><div class="setting-info"><div class="setting-name">动态背景</div></div><label class="toggle-switch"><input type="checkbox" id="fsDynamicBg" ' + (settings.dynamicBackground ? 'checked' : '') + '><span class="toggle-slider"></span></label></div>\n        <div class="setting-item"><div class="setting-info"><div class="setting-name">显示歌词</div></div><label class="toggle-switch"><input type="checkbox" id="fsShowLyrics" ' + (settings.showLyrics ? 'checked' : '') + '><span class="toggle-slider"></span></label></div>\n        <div class="setting-item"><div class="setting-info"><div class="setting-name">浮空歌词</div></div><label class="toggle-switch"><input type="checkbox" id="fsFloatingLyrics" ' + (settings.floatingLyricsEnabled ? 'checked' : '') + '><span class="toggle-slider"></span></label></div>\n        <div class="setting-item"><div class="setting-info"><div class="setting-name">播放时自动全屏</div></div><label class="toggle-switch"><input type="checkbox" id="fsAutoFullscreen" ' + (settings.autoFullscreen ? 'checked' : '') + '><span class="toggle-slider"></span></label></div>\n        <div class="setting-item"><div class="setting-info"><div class="setting-name">无缝过渡</div></div><label class="toggle-switch"><input type="checkbox" id="fsCrossfade" ' + (settings.crossfade ? 'checked' : '') + '><span class="toggle-slider"></span></label></div>\n        <div class="setting-item"><div class="setting-info"><div class="setting-name">无缝过渡时长</div></div><select id="fsCrossfadeDuration" style="padding:4px 8px;border:none;background:var(--glass-bg);border-radius:10px;font-size:12px;"><option value="1500" ' + (settings.crossfadeDuration === 1500 ? 'selected' : '') + '>1.5 秒</option><option value="3000" ' + (settings.crossfadeDuration === 3000 ? 'selected' : '') + '>3 秒</option><option value="5000" ' + (settings.crossfadeDuration === 5000 ? 'selected' : '') + '>5 秒</option><option value="8000" ' + (settings.crossfadeDuration === 8000 ? 'selected' : '') + '>8 秒</option></select></div>\n        <div class="setting-item"><div class="setting-info"><div class="setting-name">默认音质</div></div><select id="fsQualityPreference" style="padding:4px 8px;border:none;background:var(--glass-bg);border-radius:10px;font-size:12px;"><option value="hires" ' + (settings.qualityPreference === 'hires' ? 'selected' : '') + '>母带音质</option><option value="lossless" ' + (settings.qualityPreference === 'lossless' ? 'selected' : '') + '>无损音质</option><option value="exhigh" ' + (settings.qualityPreference === 'exhigh' ? 'selected' : '') + '>极高音质</option><option value="higher" ' + (settings.qualityPreference === 'higher' ? 'selected' : '') + '>较高音质</option><option value="standard" ' + (settings.qualityPreference === 'standard' ? 'selected' : '') + '>标准音质</option></select></div>\n        <div class="setting-item"><div class="setting-info"><div class="setting-name">睡眠定时器</div></div><select id="fsSleepTimer" style="padding:4px 8px;border:none;background:var(--glass-bg);border-radius:10px;font-size:12px;"><option value="0" ' + (settings.sleepTimer === 0 ? 'selected' : '') + '>关闭</option><option value="15" ' + (settings.sleepTimer === 15 ? 'selected' : '') + '>15 分钟</option><option value="30" ' + (settings.sleepTimer === 30 ? 'selected' : '') + '>30 分钟</option><option value="45" ' + (settings.sleepTimer === 45 ? 'selected' : '') + '>45 分钟</option><option value="60" ' + (settings.sleepTimer === 60 ? 'selected' : '') + '>60 分钟</option><option value="90" ' + (settings.sleepTimer === 90 ? 'selected' : '') + '>90 分钟</option><option value="120" ' + (settings.sleepTimer === 120 ? 'selected' : '') + '>120 分钟</option></select></div>\n    ';
    fullscreenSettingsGrid.innerHTML = html;
    document.getElementById('fsDarkTheme').addEventListener('change', function(e) { settings.darkTheme = e.target.checked; saveSettings(); toggleTheme(); });
    document.getElementById('fsAnimation').addEventListener('change', function(e) { settings.animations = e.target.checked; saveSettings(); if (settings.animations) { document.body.classList.remove('animations-disabled'); } else { document.body.classList.add('animations-disabled'); } });
    document.getElementById('fsSuperPerformance').addEventListener('change', function(e) { settings.superPerformance = e.target.checked; saveSettings(); applySuperPerformance(); });
    document.getElementById('fsCoverRotation').addEventListener('change', function(e) { settings.coverRotation = e.target.checked; if (!settings.coverRotation) { nowPlayingCover.classList.remove('playing', 'cover-rotation'); fullscreenCover.classList.remove('playing', 'cover-rotation'); resetCoverAnimation(nowPlayingCover); resetCoverAnimation(fullscreenCover); } else { nowPlayingCover.classList.add('cover-rotation'); fullscreenCover.classList.add('cover-rotation'); if (isPlaying) { nowPlayingCover.classList.add('playing'); fullscreenCover.classList.add('playing'); } } saveSettings(); });
    document.getElementById('fsDynamicBg').addEventListener('change', function(e) { settings.dynamicBackground = e.target.checked; saveSettings(); if (!settings.dynamicBackground) { dynamicBackground.classList.remove('active'); fullscreenDynamicBg.classList.remove('active'); currentBackgroundUrl = ''; } else if (currentIndex !== -1 && currentSongs[currentIndex]) { updateDynamicBackground(currentSongs[currentIndex].picurl); } });
    document.getElementById('fsShowLyrics').addEventListener('change', function(e) { settings.showLyrics = e.target.checked; saveSettings(); if (!settings.showLyrics) { if (floatingLyrics) { floatingLyrics.classList.remove('visible'); floatingLyrics.style.opacity = '0'; } lyricsContainer.style.display = 'none'; lyricsContainer.innerHTML = '<div class="no-lyrics"><i class="fas fa-microphone-alt"></i><p>歌词已关闭</p></div>'; } else { lyricsContainer.style.display = 'block'; if (currentIndex !== -1 && currentSongs[currentIndex]) { loadLyrics(currentSongs[currentIndex].id, currentSongs[currentIndex].platform); startLyricsRaf(); } else { lyricsContainer.innerHTML = '<div class="no-lyrics"><i class="fas fa-microphone-alt"></i><p>暂无歌词</p></div>'; } } });
    document.getElementById('fsFloatingLyrics').addEventListener('change', function(e) { settings.floatingLyricsEnabled = e.target.checked; saveSettings(); if (!settings.floatingLyricsEnabled) { if (floatingLyrics) { floatingLyrics.classList.remove('visible'); floatingLyrics.style.opacity = '0'; } } });
    document.getElementById('fsAutoFullscreen').addEventListener('change', function(e) { settings.autoFullscreen = e.target.checked; saveSettings(); });
    document.getElementById('fsCrossfade').addEventListener('change', function(e) { settings.crossfade = e.target.checked; saveSettings(); });
    document.getElementById('fsCrossfadeDuration').addEventListener('change', function(e) { settings.crossfadeDuration = parseInt(e.target.value); saveSettings(); });
    document.getElementById('fsQualityPreference').addEventListener('change', function(e) { settings.qualityPreference = e.target.value; currentQuality = settings.qualityPreference; qualityButtons.forEach(function(btn) { btn.classList.toggle('active', btn.dataset.quality === currentQuality); }); updateQualityLabel(); saveSettings(); });
    document.getElementById('fsSleepTimer').addEventListener('change', function(e) { var minutes = parseInt(e.target.value); if (minutes > 0) { startSleepTimer(minutes); } else { cancelSleepTimer(); } });
}

function updatePlayModeUI() {
    if (!fullscreenModeBtn) return;
    var icon = fullscreenModeBtn.querySelector('i');
    fullscreenModeBtn.classList.remove('mode-list', 'mode-single', 'mode-random');
    if (settings.playMode === 'list') { icon.className = 'fas fa-repeat'; fullscreenModeBtn.classList.add('mode-list'); }
    else if (settings.playMode === 'single') { icon.className = 'fas fa-repeat'; fullscreenModeBtn.classList.add('mode-single'); }
    else if (settings.playMode === 'random') { icon.className = 'fas fa-random'; fullscreenModeBtn.classList.add('mode-random'); }
}

function togglePlayMode() {
    var modes = ['list', 'single', 'random'];
    var idx = modes.indexOf(settings.playMode);
    settings.playMode = modes[(idx + 1) % modes.length];
    updatePlayModeUI();
    var modeBtn = document.querySelector('.player-mode-btn');
    if (modeBtn) updatePlayerModeIcon(modeBtn, modeBtn.querySelector('i'));
    saveSettings();
    showToast('播放模式：' + (settings.playMode === 'list' ? '列表循环' : settings.playMode === 'single' ? '单曲循环' : '随机播放'), 'info');
}

function addPlayerModeButton() {
    var playerRight = document.querySelector('.player-right');
    if (!playerRight || document.querySelector('.player-mode-btn')) return;
    var modeBtn = document.createElement('button');
    modeBtn.className = 'player-mode-btn';
    modeBtn.setAttribute('title', '播放模式');
    var icon = document.createElement('i');
    modeBtn.appendChild(icon);
    playerRight.insertBefore(modeBtn, playerRight.firstChild);
    updatePlayerModeIcon(modeBtn, icon);
    modeBtn.addEventListener('click', function() { togglePlayMode(); updatePlayerModeIcon(modeBtn, icon); });
}

function updatePlayerModeIcon(btn, icon) {
    if (settings.playMode === 'list') { icon.className = 'fas fa-repeat'; btn.classList.remove('mode-single', 'mode-random'); }
    else if (settings.playMode === 'single') { icon.className = 'fas fa-repeat'; btn.classList.add('mode-single'); btn.classList.remove('mode-random'); }
    else if (settings.playMode === 'random') { icon.className = 'fas fa-random'; btn.classList.add('mode-random'); btn.classList.remove('mode-single'); }
}

function createUserProfileModal() {
    if (userProfileModal) return;
    var modalHTML = '\n        <div class="modal" id="userProfileModal">\n            <div class="modal-content user-profile-modal">\n                <div class="modal-header"><h2 class="modal-title">个人主页</h2><button class="close-btn" id="closeUserProfileModal"><i class="fas fa-times"></i></button></div>\n                <div class="user-profile-content" id="userProfileContent"></div>\n            </div>\n        </div>';
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    userProfileModal = document.getElementById('userProfileModal');
    document.getElementById('closeUserProfileModal').addEventListener('click', function() { userProfileModal.classList.remove('active'); });
    userProfileModal.addEventListener('click', function(e) { if (e.target === userProfileModal) userProfileModal.classList.remove('active'); });
}

function openUserProfileModal() {
    if (!isLoggedIn || !currentUser) { showToast('请先登录', 'warning'); loginModal.classList.add('active'); return; }
    var totalFavoritesCount = favorites.length;
    var totalPlayCount = 0, totalPlayTime = 0;
    playHistory.forEach(function(record) { totalPlayCount += record.playCount || 1; totalPlayTime += (record.song.duration || 0) * (record.playCount || 1); });
    var totalPlayTimeFormatted = formatTime(totalPlayTime / 1000);
    var recentSongs = playHistory.slice(0, 5).map(function(record) { return record.song; });
    var recentSongsHTML = recentSongs.length ? recentSongs.map(function(song) {
        return '\n        <div class="recent-song-item" data-id="' + song.id + '">\n            <div class="recent-song-cover">' + (song.picurl ? '<img src="' + song.picurl + '" onerror="this.style.display=\'none\'">' : '<i class="fas fa-music"></i>') + '</div>\n            <div class="recent-song-info"><div class="recent-song-title">' + escapeHtml(song.name) + '</div><div class="recent-song-artist">' + escapeHtml(song.artistsname) + '</div></div>\n        </div>';
    }).join('') : '<div class="empty-text">暂无播放记录</div>';
    var contentHTML = '\n        <div class="profile-avatar"><div class="avatar-circle">' + currentUser.username.charAt(0).toUpperCase() + '</div></div>\n        <div class="profile-info"><h3>' + escapeHtml(currentUser.username) + '</h3><p>' + escapeHtml(currentUser.email) + '</p><p>注册于 ' + new Date(currentUser.createdAt).toLocaleDateString() + '</p></div>\n        <div class="profile-stats"><div class="stat-item"><div class="stat-value">' + totalFavoritesCount + '</div><div class="stat-label">收藏歌曲</div></div><div class="stat-item"><div class="stat-value">' + totalPlayCount + '</div><div class="stat-label">播放次数</div></div><div class="stat-item"><div class="stat-value">' + totalPlayTimeFormatted + '</div><div class="stat-label">总播放时长</div></div></div>\n        <div class="profile-section"><h4>最近播放</h4><div class="recent-songs-list">' + recentSongsHTML + '</div></div>\n        <div class="profile-actions"><button class="btn" id="profileEditBtn"><i class="fas fa-edit"></i> 编辑资料</button><button class="btn" id="profileLogoutBtn" style="background:transparent;border:1px solid var(--glass-border);"><i class="fas fa-sign-out-alt"></i> 退出登录</button></div>';
    document.getElementById('userProfileContent').innerHTML = contentHTML;
    document.getElementById('profileEditBtn').addEventListener('click', function() { userProfileModal.classList.remove('active'); openAccountSettings(); });
    document.getElementById('profileLogoutBtn').addEventListener('click', function() { userProfileModal.classList.remove('active'); handleLogout(); });
    document.querySelectorAll('.recent-song-item').forEach(function(item) {
        item.addEventListener('click', function() {
            var songId = item.dataset.id;
            var song = playHistory.find(function(r) { return String(r.song.id) === String(songId); });
            if (song) { var index = currentSongs.findIndex(function(s) { return String(s.id) === String(song.song.id); }); playSong(song.song, index !== -1 ? index : 0); userProfileModal.classList.remove('active'); }
        });
    });
    userProfileModal.classList.add('active');
}

function escapeHtml(str) { if (!str) return ''; return str.replace(/[&<>]/g, function(m) { if (m === '&') return '&amp;'; if (m === '<') return '&lt;'; if (m === '>') return '&gt;'; return m; }); }
function escapeAttr(str) { if (!str) return ''; return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// ============================================
// 卡片渲染器（直接渲染，无懒加载，兼容 WebView）
// ============================================

function renderLazyCards(container, songs, cardRenderer, eventBinder) {
    container.innerHTML = '';
    if (!songs || songs.length === 0) return;
    var fragment = document.createDocumentFragment();

    songs.forEach(function(song, index) {
        var cardHTML = cardRenderer(song, index);
        var temp = document.createElement('div');
        temp.innerHTML = cardHTML;
        var card = temp.firstElementChild;
        if (card) {
            fragment.appendChild(card);
            if (eventBinder) eventBinder(card, song, index);
        }
    });

    container.appendChild(fragment);
}

// ============================================
// 播放状态保存与恢复
// ============================================
function saveLastPlaybackState() {
    if (currentIndex !== -1 && currentSongs[currentIndex]) {
        var song = currentSongs[currentIndex];
        lastPlaybackState = { songId: song.id, currentTime: audioPlayer.currentTime || 0, isPlaying: isPlaying, quality: currentQuality, songData: song, playlist: currentSongs };
        localStorage.setItem('anyListenLastPlayback', JSON.stringify(lastPlaybackState));
    }
}

function loadLastPlaybackState() {
    var saved = localStorage.getItem('anyListenLastPlayback');
    if (saved) try { lastPlaybackState = JSON.parse(saved); } catch(e) {}
}

function autoRestorePlayback() {
    if (playHistory.length > 0) {
        var firstRecord = playHistory[0];
        var song = firstRecord.song;
        if (song) {
            currentSongs = [song];
            currentIndex = 0;
            nowPlayingTitle.textContent = song.name;
            nowPlayingArtist.textContent = song.artistsname + ' · ' + (song.album || '');
            fullscreenTitle.textContent = song.name;
            fullscreenArtist.textContent = song.artistsname + ' · ' + (song.album || '');
            updateAlbumCover(song);
            if (song.picurl && settings.dynamicBackground) updateDynamicBackground(song.picurl);
            playerContainer.style.display = 'flex';
            if (lastPlaybackState.songId && String(lastPlaybackState.songId) === String(song.id) && lastPlaybackState.currentTime > 0) {
                audioPlayer.currentTime = lastPlaybackState.currentTime;
                setTimeout(function() {
                    var percent = (audioPlayer.currentTime / audioPlayer.duration) * 100 || 0;
                    progress.style.width = percent + '%';
                    fullscreenProgress.style.width = percent + '%';
                    currentTimeEl.textContent = formatTime(audioPlayer.currentTime);
                    fullscreenCurrentTime.textContent = formatTime(audioPlayer.currentTime);
                }, 200);
            }
            showToast('已恢复上次播放的歌曲', 'info');
        }
    } else if (lastPlaybackState.songData) {
        var song = lastPlaybackState.songData;
        currentSongs = [song];
        currentIndex = 0;
        nowPlayingTitle.textContent = song.name;
        nowPlayingArtist.textContent = song.artistsname + ' · ' + (song.album || '');
        fullscreenTitle.textContent = song.name;
        fullscreenArtist.textContent = song.artistsname + ' · ' + (song.album || '');
        updateAlbumCover(song);
        if (song.picurl && settings.dynamicBackground) updateDynamicBackground(song.picurl);
        playerContainer.style.display = 'flex';
        if (lastPlaybackState.currentTime > 0) {
            audioPlayer.currentTime = lastPlaybackState.currentTime;
            setTimeout(function() {
                var percent = (audioPlayer.currentTime / audioPlayer.duration) * 100 || 0;
                progress.style.width = percent + '%';
                fullscreenProgress.style.width = percent + '%';
                currentTimeEl.textContent = formatTime(audioPlayer.currentTime);
                fullscreenCurrentTime.textContent = formatTime(audioPlayer.currentTime);
            }, 200);
        }
        showToast('已恢复上次播放的歌曲', 'info');
    }
}

function saveCurrentPagePosition() {
    if (settings.rememberLastPosition) {
        lastPagePosition = { page: currentPage, scrollTop: mainContent.scrollTop };
        localStorage.setItem('anyListenLastPagePosition', JSON.stringify(lastPagePosition));
    }
}

function loadLastPagePosition() {
    var saved = localStorage.getItem('anyListenLastPagePosition');
    if (saved) try { lastPagePosition = JSON.parse(saved); } catch(e) {}
}

function restoreLastPagePosition() {
    if (settings.rememberLastPosition && lastPagePosition.page) {
        switchPage(lastPagePosition.page);
        setTimeout(function() { mainContent.scrollTop = lastPagePosition.scrollTop || 0; }, 100);
    }
}

// ============================================
// 动态背景
// ============================================
function updateDynamicBackground(imageUrl) {
    if (!imageUrl) { dynamicBackground.classList.remove('active'); fullscreenDynamicBg.classList.remove('active'); currentBackgroundUrl = ''; return; }
    if (currentBackgroundUrl === imageUrl) { dynamicBackground.classList.add('active'); fullscreenDynamicBg.classList.add('active'); return; }
    currentBackgroundUrl = imageUrl;
    var img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = function() {
        dynamicBackground.style.backgroundImage = 'url(\'' + imageUrl + '\')';
        dynamicBackground.classList.add('active');
        fullscreenDynamicBg.style.backgroundImage = 'url(\'' + imageUrl + '\')';
        fullscreenDynamicBg.classList.add('active');
        extractDominantColor(img, function(color) {
            fullscreenProgress.style.background = color;
            fullscreenProgress.style.setProperty('--progress-color', color);
        });
    };
    img.onerror = function() {
        dynamicBackground.classList.remove('active');
        fullscreenDynamicBg.classList.remove('active');
        currentBackgroundUrl = ''
        fullscreenProgress.style.background = 'linear-gradient(90deg, var(--primary), var(--accent))';
    };
    img.src = imageUrl;
}

function extractDominantColor(img, callback) {
    try {
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');
        var size = 50;
        canvas.width = size; canvas.height = size;
        ctx.drawImage(img, 0, 0, size, size);
        var data = ctx.getImageData(0, 0, size, size).data;
        var r = 0, g = 0, b = 0, count = 0;
        for (var i = 0; i < data.length; i += 4) { r += data[i]; g += data[i+1]; b += data[i+2]; count++; }
        r = Math.floor(r/count); g = Math.floor(g/count); b = Math.floor(b/count);
        callback('rgb(' + r + ', ' + g + ', ' + b + ')');
    } catch(e) { callback('linear-gradient(90deg, var(--primary), var(--accent))'); }
}

// ============================================
// APP 下载
// ============================================
function openDownloadAppModal() {
    downloadCountdown = 3;
    downloadTimerEl.textContent = downloadCountdown + '秒后自动跳转';
    downloadProgressBar.style.width = '0%';
    downloadAppModal.classList.add('active');
    startDownloadCountdown();
}

function startDownloadCountdown() {
    if (downloadTimer) clearInterval(downloadTimer);
    var progress = 0;
    var step = 100 / (downloadCountdown * 10);
    var countdown = downloadCountdown;
    downloadTimer = setInterval(function() {
        progress += step;
        if (progress > 100) progress = 100;
        downloadProgressBar.style.width = progress + '%';
        if (Math.floor(progress) % 33 === 0) {
            countdown--;
            if (countdown <= 0) {
                downloadTimerEl.textContent = '正在跳转...';
                setTimeout(function() { window.open(APP_DOWNLOAD_URL, '_blank'); closeDownloadAppModalHandler(); }, 500);
            } else downloadTimerEl.textContent = countdown + '秒后自动跳转';
        }
    }, 100);
}

function closeDownloadAppModalHandler() {
    if (downloadTimer) { clearInterval(downloadTimer); downloadTimer = null; }
    downloadAppModal.classList.remove('active');
    downloadProgressBar.style.width = '0%';
}

// ============================================
// 侧边栏
// ============================================
function toggleMobileMenu() {
    var isActive = sidebar.classList.contains('active');
    sidebar.classList.toggle('active', !isActive);
    overlay.classList.toggle('show', !isActive);
    hamburgerMenu.classList.toggle('active', !isActive);
    document.body.style.overflow = !isActive ? 'hidden' : ''
}

function closeMobileSidebar() {
    sidebar.classList.remove('active');
    overlay.classList.remove('show');
    hamburgerMenu.classList.remove('active');
    document.body.style.overflow = ''
}

function toggleDesktopSidebar() {
    sidebar.classList.toggle('collapsed');
    settings.sidebarCollapsed = sidebar.classList.contains('collapsed');
    saveSettings();
    showToast('侧边栏' + (settings.sidebarCollapsed ? '已收起' : '已展开'), 'info');
}

function handleResize() {
    var width = window.innerWidth;
    if (width <= 992) {
        hamburgerMenu.style.display = 'flex';
        sidebarToggleDesktop.style.display = 'none';
        sidebar.classList.remove('collapsed');
        if (sidebar.classList.contains('active')) closeMobileSidebar();
        document.getElementById('mobileSearchCard').style.display = 'block';
        document.getElementById('navSearchWrapper').style.display = 'none';
    } else {
        hamburgerMenu.style.display = 'none';
        overlay.classList.remove('show');
        document.body.style.overflow = ''
        hamburgerMenu.classList.remove('active');
        sidebarToggleDesktop.style.display = 'flex';
        if (settings.sidebarCollapsed) sidebar.classList.add('collapsed');
        else sidebar.classList.remove('collapsed');
        document.getElementById('mobileSearchCard').style.display = 'none';
        document.getElementById('navSearchWrapper').style.display = 'block';
    }
}

// ============================================
// 主题
// ============================================
function toggleTheme() {
    var isLight = document.body.classList.contains('light-theme');
    if (isLight) {
        document.body.classList.remove('light-theme');
        themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
        settings.darkTheme = true;
        if (settings.dynamicBackground && currentIndex !== -1 && currentSongs[currentIndex]) {
            var song = currentSongs[currentIndex];
            updateDynamicBackground(song.picurl);
        }
        showToast('已切换到暗色主题', 'info');
    } else {
        document.body.classList.add('light-theme');
        themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        settings.darkTheme = false;
        if (settings.dynamicBackground && currentIndex !== -1 && currentSongs[currentIndex]) {
            var song = currentSongs[currentIndex];
            updateDynamicBackground(song.picurl);
        } else {
            dynamicBackground.classList.remove('active');
            fullscreenDynamicBg.classList.remove('active');
        }
        showToast('已切换到明亮主题', 'info');
    }
    saveSettings();
    var darkToggle = document.getElementById('darkThemeToggle');
    if (darkToggle) darkToggle.checked = settings.darkTheme;
}

// ============================================
// 用户系统
// ============================================
function loadUserData() {
    var saved = localStorage.getItem('anyListenUser');
    if (saved) { currentUser = JSON.parse(saved); isLoggedIn = true; var rm = localStorage.getItem('anyListenRememberMe'); if (rm === 'true') rememberMe = true; }
}
function saveUserData() { if (currentUser) { localStorage.setItem('anyListenUser', JSON.stringify(currentUser)); if (rememberMe) localStorage.setItem('anyListenRememberMe', 'true'); else localStorage.removeItem('anyListenRememberMe'); } }
function updateLoginUI() {
    userStatus.innerHTML = ''
    if (isLoggedIn && currentUser) {
        var avatar = document.createElement('div');
        avatar.className = 'user-avatar';
        avatar.innerHTML = '<span>' + currentUser.username.charAt(0).toUpperCase() + '</span>';
        avatar.addEventListener('click', function(e) { e.stopPropagation(); userMenu.classList.toggle('active'); userMenuName.textContent = currentUser.username; });
        userStatus.appendChild(avatar);
    } else {
        var loginButton = document.createElement('button');
        loginButton.className = 'login-btn';
        loginButton.innerHTML = '<i class="fas fa-sign-in-alt"></i><span>登录</span>';
        loginButton.addEventListener('click', function() { loginModal.classList.add('active'); });
        userStatus.appendChild(loginButton);
    }
}
function handleLogin() {
    var email = document.getElementById('loginEmail').value.trim();
    var password = document.getElementById('loginPassword').value.trim();
    rememberMe = document.getElementById('rememberMe').checked;
    if (!email || !password) { showAuthError('请输入邮箱和密码'); return; }
    var users = JSON.parse(localStorage.getItem('anyListenUsers') || '[]');
    var user = users.find(function(u) { return u.email === email && u.password === password; });
    if (user) {
        currentUser = { ...user };
        isLoggedIn = true;
        saveUserData();
        updateLoginUI();
        loginModal.classList.remove('active');
        showNotification('登录成功！请刷新浏览器','success');
        hideAuthError();
        document.getElementById('loginEmail').value = ''
        document.getElementById('loginPassword').value = ''
    } else showAuthError('邮箱或密码错误');
}
function handleRegister() {
    var username = document.getElementById('registerUsername').value.trim();
    var email = document.getElementById('registerEmail').value.trim();
    var password = document.getElementById('registerPassword').value.trim();
    var confirmPassword = document.getElementById('confirmPassword').value.trim();
    var termsAgreed = document.getElementById('termsAgreement').checked;
    if (!username || !email || !password || !confirmPassword) { showAuthError('请填写所有字段'); return; }
    if (password.length < 6) { showAuthError('密码至少需要6位'); return; }
    if (password !== confirmPassword) { showAuthError('两次输入的密码不一致'); return; }
    if (!termsAgreed) { showAuthError('请同意《Any Sound使用条款》'); return; }
    var users = JSON.parse(localStorage.getItem('anyListenUsers') || '[]');
    if (users.some(function(u) { return u.email === email; })) { showAuthError('该邮箱已被注册'); return; }
    var newUser = { id: Date.now(), username: username, email: email, password: password, createdAt: new Date().toISOString(), favorites: [], settings: {}, lastLogin: new Date().toISOString() };
    users.push(newUser);
    localStorage.setItem('anyListenUsers', JSON.stringify(users));
    currentUser = { ...newUser };
    isLoggedIn = true;
    saveUserData();
    updateLoginUI();
    loginModal.classList.remove('active');
    showNotification('注册成功！已自动登录,请刷新浏览器', 'success');
    hideAuthError();
    document.getElementById('registerUsername').value = ''
    document.getElementById('registerEmail').value = ''
    document.getElementById('registerPassword').value = ''
    document.getElementById('confirmPassword').value = ''
    loginTabBtn.click();
}
function openAccountSettings() {
    if (!isLoggedIn) { showNotification('请先登录', 'warning'); loginModal.classList.add('active'); return; }
    updateAccountInfo();
    accountSettingsModal.classList.add('active');
}
function updateAccountInfo() {
    if (!currentUser) return;
    var userData = { favorites: favorites, playHistory: playHistory, settings: settings, userInfo: { username: currentUser.username, email: currentUser.email, createdAt: currentUser.createdAt, lastLogin: currentUser.lastLogin } };
    var size = (JSON.stringify(userData).length / 1024).toFixed(2);
    accountInfo.innerHTML = '\n        <div class="account-avatar"><span>' + currentUser.username.charAt(0).toUpperCase() + '</span></div>\n        <div class="account-details"><h3>' + escapeHtml(currentUser.username) + '</h3><p>' + escapeHtml(currentUser.email) + '</p><p>注册时间: ' + new Date(currentUser.createdAt).toLocaleDateString() + '</p><p>数据大小: ' + size + ' KB</p></div>';
    document.getElementById('updateUsername').value = currentUser.username;
    document.getElementById('updateEmail').value = currentUser.email;
}
function handleUpdateAccount() {
    if (!isLoggedIn) return;
    var username = document.getElementById('updateUsername').value.trim();
    var email = document.getElementById('updateEmail').value.trim();
    var currentPassword = document.getElementById('currentPassword').value.trim();
    var newPassword = document.getElementById('newPassword').value.trim();
    var confirmNewPassword = document.getElementById('confirmNewPassword').value.trim();
    if (!username || !email) { showAccountError('用户名和邮箱不能为空'); return; }
    if (!currentPassword) { showAccountError('请输入当前密码以验证身份'); return; }
    var users = JSON.parse(localStorage.getItem('anyListenUsers') || '[]');
    var userIndex = users.findIndex(function(u) { return u.id === currentUser.id; });
    if (users[userIndex].password !== currentPassword) { showAccountError('当前密码错误'); return; }
    if (email !== currentUser.email && users.some(function(u) { return u.email === email && u.id !== currentUser.id; })) { showAccountError('该邮箱已被其他用户使用'); return; }
    if (newPassword) {
        if (newPassword.length < 6) { showAccountError('新密码至少需要6位'); return; }
        if (newPassword !== confirmNewPassword) { showAccountError('两次输入的新密码不一致'); return; }
        users[userIndex].password = newPassword;
    }
    users[userIndex].username = username;
    users[userIndex].email = email;
    users[userIndex].lastLogin = new Date().toISOString();
    localStorage.setItem('anyListenUsers', JSON.stringify(users));
    currentUser = users[userIndex];
    saveUserData();
    updateLoginUI();
    accountSettingsModal.classList.remove('active');
    showNotification('账号信息更新成功', 'success');
    hideAccountError();
    document.getElementById('currentPassword').value = ''
    document.getElementById('newPassword').value = ''
    document.getElementById('confirmNewPassword').value = ''
}
function exportAccountData() {
    if (!isLoggedIn) { showNotification('请先登录', 'warning'); return; }
    var accountData = { version: '26.24.5', exportDate: new Date().toISOString(), user: { username: currentUser.username, email: currentUser.email, createdAt: currentUser.createdAt, lastLogin: currentUser.lastLogin }, favorites: favorites, playHistory: playHistory, playlists: playlists, settings: settings, dataInfo: { favoritesCount: favorites.length, historyCount: playHistory.length, playlistsCount: playlists.length } };
    var dataStr = JSON.stringify(accountData, null, 2);
    var blob = new Blob([dataStr], {type: 'application/json'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'anylisten_backup_' + currentUser.username + '_' + new Date().toISOString().slice(0,10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('账号数据导出成功，共 ' + favorites.length + ' 收藏，' + playHistory.length + ' 历史记录，' + playlists.length + ' 个歌单', 'success');
}
function handleImportAccountData(event) {
    var file = event.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
        try {
            var imported = JSON.parse(e.target.result);
            if (!imported.user || !imported.favorites || !imported.playHistory) { showNotification('导入失败：数据格式不正确', 'error'); return; }
            if (imported.version !== '26.24.5' && !confirm('导入的数据版本为 ' + (imported.version || '未知') + '，当前版本为 26.24.5，继续导入可能不兼容，是否继续？')) return;
            if (confirm('确定要导入以下数据吗？\n收藏歌曲：' + imported.favorites.length + ' 首\n播放历史：' + imported.playHistory.length + ' 条\n歌单：' + (imported.playlists ? imported.playlists.length : 0) + ' 个\n设置项：' + Object.keys(imported.settings || {}).length + ' 个')) {
                favorites = imported.favorites || [];
                playHistory = imported.playHistory || [];
                playlists = imported.playlists || [];
                settings = { ...settings, ...(imported.settings || {}) };
                saveFavorites();
                savePlayHistory();
                savePlaylists();
                saveSettings();
                updateFavoritesCount();
                updateHistoryCount();
                updateFavoritesPage();
                updateHistoryPage();
                updatePlaylistsPage();
                updateSettingsPage();
                showNotification('账号数据导入成功', 'success');
                importAccountDataFile.value = ''
            }
        } catch (error) { showNotification('导入失败：数据解析错误', 'error'); }
    };
    reader.readAsText(file);
}
function handleDeleteAccount() {
    if (!isLoggedIn) return;
    if (confirm('确定要删除账号吗？此操作将永久删除您的所有数据，包括收藏、播放历史和设置，且不可恢复！')) {
        if (prompt('请输入您的密码以确认删除操作：') === currentUser.password) {
            var users = JSON.parse(localStorage.getItem('anyListenUsers') || '[]');
            localStorage.setItem('anyListenUsers', JSON.stringify(users.filter(function(u) { return u.id !== currentUser.id; })));
            localStorage.removeItem('anyListenUser');
            localStorage.removeItem('anyListenRememberMe');
            localStorage.removeItem('anyListenFavorites');
            localStorage.removeItem('anyListenHistory');
            localStorage.removeItem('anyListenSettings');
            localStorage.removeItem('anyListenLastPlayback');
            localStorage.removeItem('anyListenLastPagePosition');
            currentUser = null; isLoggedIn = false; favorites = []; playHistory = [];
            lastPlaybackState = { songId: null, currentTime: 0, isPlaying: false, quality: 'hires' };
            lastPagePosition = { page: 'home', scrollTop: 0 };
            updateLoginUI();
            updateFavoritesCount();
            updateHistoryCount();
            updateFavoritesPage();
            updateHistoryPage();
            accountSettingsModal.classList.remove('active');
            showNotification('账号已成功删除', 'success');
            resetPageTitle();
        } else showAccountError('密码错误，删除操作已取消');
    }
}
function handleLogout() {
    if (confirm('确定要退出登录吗？')) {
        currentUser = null; isLoggedIn = false; rememberMe = false;
        localStorage.removeItem('anyListenUser');
        localStorage.removeItem('anyListenRememberMe');
        updateLoginUI();
        userMenu.classList.remove('active');
        showNotification('已退出登录', 'info');
        resetPageTitle();
    }
}
function showAuthError(msg) { authErrorText.textContent = msg; authError.classList.add('show'); }
function hideAuthError() { authError.classList.remove('show'); }
function showAccountError(msg) { accountErrorText.textContent = msg; accountError.classList.add('show'); }
function hideAccountError() { accountError.classList.remove('show'); }

// ============================================
// 设置
// ============================================
function loadSettings() {
    var saved = localStorage.getItem('anyListenSettings');
    if (saved) {
        var loaded = JSON.parse(saved);
        settings = { ...settings, ...loaded };
        if (settings.darkTheme) {
            document.body.classList.remove('light-theme');
            themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
        } else {
            document.body.classList.add('light-theme');
            themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        }
        if (settings.sidebarCollapsed && window.innerWidth > 992) sidebar.classList.add('collapsed');
        currentQuality = settings.qualityPreference;
        qualityButtons.forEach(function(btn) { btn.classList.toggle('active', btn.dataset.quality === currentQuality); });
        updateQualityLabel();
        if (settings.dynamicBackground === undefined) settings.dynamicBackground = true;
        if (settings.rememberLastPosition === undefined) settings.rememberLastPosition = false;
        if (settings.playMode === undefined) settings.playMode = 'list';
        if (settings.crossfade === undefined) settings.crossfade = false;
        if (settings.crossfadeDuration === undefined) settings.crossfadeDuration = 3000;
        if (settings.autoFullscreen === undefined) settings.autoFullscreen = true;
        if (!settings.themeColor) settings.themeColor = '#7c3aed';
        if (!settings.fontFamily) settings.fontFamily = 'Inter, system-ui, sans-serif';
        if (settings.fontFamily === "'Comic Sans MS', 'YouYuan', cursive") settings.fontFamily = "'ComicSansLocal', 'YouYuanLocal', 'Comic Sans MS', cursive";
        if (settings.autoSwitchOnNeteaseError === undefined) settings.autoSwitchOnNeteaseError = true;
        if (settings.mobileAndroidStyle === undefined) settings.mobileAndroidStyle = true;
        if (!settings.uiMode) settings.uiMode = 'simple';
        applyThemeColor(settings.themeColor);
        applyFontFamily(settings.fontFamily);
    }
    if (!settings.animations) {
        document.body.classList.add('animations-disabled');
    } else {
        document.body.classList.remove('animations-disabled');
    }
    applyUIMode();
}

function saveSettings() {
    localStorage.setItem('anyListenSettings', JSON.stringify(settings));
}

function applyUIMode() {
    var isMobile = window.innerWidth <= 767;

    if (isMobile && settings.mobileAndroidStyle) {
        document.body.classList.add('mobile-android-style');
        createMobileBottomNav();
        setTimeout(function() {
            var mn = document.getElementById('mobileBottomNav');
            if (mn && currentPage) {
                var inner = mn.querySelector('.mobile-bottom-nav-inner');
                if (inner) {
                    inner.querySelectorAll('.mobile-nav-item').forEach(function(it) { it.classList.remove('active'); });
                    var ni = inner.querySelector('.mobile-nav-item[data-page="' + currentPage + '"]');
                    if (ni) ni.classList.add('active');
                }
            }
        }, 50);
    } else {
        document.body.classList.remove('mobile-android-style');
        removeMobileBottomNav();
        if (currentPage === 'settings') {
            switchPage('home');
        }
    }

    if (!isMobile) {
        if (settings.uiMode === 'simple') {
            document.body.classList.add('ui-mode-simple');
            document.body.classList.remove('ui-mode-advanced');
            document.querySelectorAll('.nav-section').forEach(function(sec) {
                var title = sec.querySelector('.section-title');
                if (title && (title.textContent.trim() === '支持' || title.textContent.trim() === '移动端')) {
                    sec.style.display = 'none';
                }
            });
        } else {
            document.body.classList.add('ui-mode-advanced');
            document.body.classList.remove('ui-mode-simple');
            document.querySelectorAll('.nav-section').forEach(function(sec) {
                sec.style.display = '';
            });
        }
    } else {
        document.body.classList.remove('ui-mode-simple', 'ui-mode-advanced');
    }
}

function createMobileBottomNav() {
    if (document.getElementById('mobileBottomNav')) return;
    var nav = document.createElement('div');
    nav.id = 'mobileBottomNav';
    nav.className = 'mobile-bottom-nav';
    nav.innerHTML = '<div class="mobile-bottom-nav-inner">' +
        '<button class="mobile-nav-item active" data-page="home"><i class="fas fa-home"></i><span>发现</span></button>' +
        '<button class="mobile-nav-item" data-page="search"><i class="fas fa-search"></i><span>搜索</span></button>' +
        '<button class="mobile-nav-item" data-page="favorites"><i class="fas fa-heart"></i><span>收藏</span></button>' +
        '<button class="mobile-nav-item" data-page="hotlist"><i class="fas fa-fire"></i><span>排行榜</span></button>' +
        '<button class="mobile-nav-item" data-page="settings" id="mobileNavSettings"><i class="fas fa-cog"></i><span>设置</span></button>' +
        '</div>';
    document.body.appendChild(nav);

    var inner = nav.querySelector('.mobile-bottom-nav-inner');
    nav.querySelectorAll('.mobile-nav-item[data-page]').forEach(function(item) {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            var page = this.dataset.page;
            inner.querySelectorAll('.mobile-nav-item').forEach(function(it) { it.classList.remove('active'); });
            this.classList.add('active');
            switchPage(page);
            if (sidebar.classList.contains('active')) {
                sidebar.classList.remove('active');
                overlay.classList.remove('show');
            }
            if (window.innerWidth <= 767) {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    });

    var settingsBtn = nav.querySelector('#mobileNavSettings');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', function(e) {
            e.preventDefault();
            inner.querySelectorAll('.mobile-nav-item').forEach(function(it) { it.classList.remove('active'); });
            this.classList.add('active');
            switchPage('settings');
            if (sidebar.classList.contains('active')) {
                sidebar.classList.remove('active');
                overlay.classList.remove('show');
            }
            if (window.innerWidth <= 767) {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }

    var appContainer = document.querySelector('.app-container');
    if (appContainer) {
        document.body.removeChild(nav);
        appContainer.appendChild(nav);
    }
    document.body.style.paddingBottom = '64px';
}

function removeMobileBottomNav() {
    var nav = document.getElementById('mobileBottomNav');
    if (nav) nav.remove();
    document.body.style.paddingBottom = '';
    var ac = document.querySelector('.app-container');
    if (ac) ac.style.paddingBottom = '';
}

window.addEventListener('resize', debounce(function() {
    applyUIMode();
}, 200));

function applyThemeColor(color) {
    document.documentElement.style.setProperty('--primary', color);
    var primaryLight = color + '99';
    document.documentElement.style.setProperty('--primary-light', primaryLight);
    var styleId = 'themeColorDynamicStyle';
    var styleEl = document.getElementById(styleId);
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
    }
    styleEl.textContent = '\n        .btn, .play-pause-btn, .search-btn, .tab-btn.active, .chart-tab.active, .platform-btn.active {\n            background: linear-gradient(135deg, ' + color + ', ' + color + 'dd) !important;\n        }\n        .quality-dropdown-item.active {\n            color: ' + color + ' !important;\n        }\n    ';
}

function applyFontFamily(font) {
    document.body.style.fontFamily = font;
}

function applySuperPerformance() {
    if (settings.superPerformance) {
        document.body.classList.add('super-performance');
        document.body.classList.add('animations-disabled');
        document.body.style.setProperty('--dynamic-bg-opacity', '0');
        if (dynamicBackground) dynamicBackground.classList.remove('active');
        if (fullscreenDynamicBg) fullscreenDynamicBg.classList.remove('active');
        currentBackgroundUrl = '';
        if (floatingLyrics) { floatingLyrics.classList.remove('visible'); floatingLyrics.style.opacity = '0'; }
        if (nowPlayingCover) { nowPlayingCover.classList.remove('playing', 'cover-rotation'); resetCoverAnimation(nowPlayingCover); }
        if (fullscreenCover) { fullscreenCover.classList.remove('playing', 'cover-rotation'); resetCoverAnimation(fullscreenCover); }
        if (lyricsContainer) lyricsContainer.innerHTML = '<div class="no-lyrics"><i class="fas fa-bolt"></i><p>超性能模式已开启</p></div>';
        stopFPSMonitor();
    } else {
        document.body.classList.remove('super-performance');
        document.body.style.removeProperty('--dynamic-bg-opacity');
        if (settings.animations) document.body.classList.remove('animations-disabled');
        if (settings.dynamicBackground && currentIndex !== -1 && currentSongs[currentIndex]) {
            updateDynamicBackground(currentSongs[currentIndex].picurl);
        }
        if (settings.coverRotation) {
            nowPlayingCover.classList.add('cover-rotation');
            fullscreenCover.classList.add('cover-rotation');
            if (isPlaying) { nowPlayingCover.classList.add('playing'); fullscreenCover.classList.add('playing'); }
        }
        if (settings.showLyrics && currentIndex !== -1 && currentSongs[currentIndex]) {
            loadLyrics(currentSongs[currentIndex].id, currentSongs[currentIndex].platform);
        } else if (settings.showLyrics) {
            lyricsContainer.innerHTML = '<div class="no-lyrics"><i class="fas fa-microphone-alt"></i><p>暂无歌词</p></div>';
        }
        startFPSMonitor();
    }
}

var fpsMonitorData = {
    frames: 0,
    lastTime: performance.now(),
    fps: 60,
    samples: [],
    timer: null,
    warned: false
};

function startFPSMonitor() {
    if (settings.superPerformance) return;
    if (fpsMonitorData.timer) return;
    fpsMonitorData.frames = 0;
    fpsMonitorData.lastTime = performance.now();
    fpsMonitorData.samples = [];
    fpsMonitorData.warned = false;
    function measureFPS() {
        if (settings.superPerformance) { fpsMonitorData.timer = null; return; }
        fpsMonitorData.frames++;
        var now = performance.now();
        var elapsed = now - fpsMonitorData.lastTime;
        if (elapsed >= 1000) {
            var currentFPS = Math.round((fpsMonitorData.frames * 1000) / elapsed);
            fpsMonitorData.fps = currentFPS;
            if (settings.showFPS) {
                var fpsEl = document.getElementById('fpsCounter');
                if (fpsEl) fpsEl.textContent = currentFPS + ' FPS';
            }
            fpsMonitorData.samples.push(currentFPS);
            if (fpsMonitorData.samples.length > 10) fpsMonitorData.samples.shift();
            fpsMonitorData.frames = 0;
            fpsMonitorData.lastTime = now;
            if (fpsMonitorData.samples.length >= 5 && !fpsMonitorData.warned) {
                var avg = fpsMonitorData.samples.reduce(function(a, b) { return a + b; }, 0) / fpsMonitorData.samples.length;
                if (avg < 25) {
                    fpsMonitorData.warned = true;
                    showSuperPerformanceWarning();
                }
            }
        }
        fpsMonitorData.timer = requestAnimationFrame(measureFPS);
    }
    measureFPS();
}

function stopFPSMonitor() {
    if (fpsMonitorData.timer) {
        cancelAnimationFrame(fpsMonitorData.timer);
        fpsMonitorData.timer = null;
    }
}

function applyShowFPS() {
    var fpsEl = document.getElementById('fpsCounter');
    if (!fpsEl) return;
    if (settings.showFPS) {
        fpsEl.style.display = 'block';
        fpsEl.style.color = settings.fpsColor || '#00ff00';
        fpsEl.style.fontSize = (settings.fpsSize || 16) + 'px';
        var opacity = (settings.fpsBgOpacity != null) ? settings.fpsBgOpacity : 0;
        fpsEl.style.background = opacity > 0 ? 'rgba(0,0,0,' + opacity + ')' : 'none';
        fpsEl.style.padding = opacity > 0 ? '4px 8px' : '0';
        fpsEl.style.borderRadius = opacity > 0 ? '4px' : '0';
        if (!fpsMonitorData.timer && !settings.superPerformance) startFPSMonitor();
    } else {
        fpsEl.style.display = 'none';
    }
}

// ============================================
// 开发者模式警告弹窗
// ============================================
function showDevModeWarning() {
    var overlay = document.createElement('div');
    overlay.className = 'dev-warning-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease;';

    var dialog = document.createElement('div');
    dialog.style.cssText = 'background:rgba(23,23,23,0.95);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:28px;max-width:400px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.5);animation:fadeUp 0.3s cubic-bezier(0.4,0,0.2,1);';

    dialog.innerHTML = '<div style="font-size:48px;margin-bottom:16px;">⚠️</div>' +
        '<h3 style="margin:0 0 12px;font-size:18px;color:#fff;">开发者模式警告</h3>' +
        '<p style="margin:0 0 8px;font-size:14px;color:rgba(255,255,255,0.7);line-height:1.6;">开启开发者模式后，将解锁实验性功能和调试选项。</p>' +
        '<p style="margin:0 0 24px;font-size:13px;color:rgba(255,255,255,0.5);line-height:1.6;">部分功能可能不稳定或影响性能，<br>请谨慎操作，后果自负。</p>' +
        '<div style="display:flex;gap:12px;justify-content:center;">' +
        '<button class="dev-warning-cancel" style="padding:10px 24px;border:1px solid rgba(255,255,255,0.15);border-radius:12px;background:transparent;color:rgba(255,255,255,0.7);font-size:14px;cursor:pointer;transition:all 0.2s;font-family:inherit;">取消</button>' +
        '<button class="dev-warning-confirm" style="padding:10px 24px;border:none;border-radius:12px;background:#7c3aed;color:#fff;font-size:14px;font-weight:600;cursor:pointer;transition:all 0.2s;font-family:inherit;">确认开启</button>' +
        '</div>';

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    function close() {
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.2s ease';
        setTimeout(function() { overlay.remove(); }, 200);
    }

    dialog.querySelector('.dev-warning-cancel').addEventListener('click', function() {
        close();
        showToast('已取消', 'info', 600);
    });

    dialog.querySelector('.dev-warning-confirm').addEventListener('click', function() {
        close();
        settings.devMode = true;
        saveSettings();
        checkDevMode();
        showToast('开发者模式已开启！', 'success', 600);
    });

    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            close();
            showToast('已取消', 'info', 600);
        }
    });

    dialog.querySelector('.dev-warning-cancel').addEventListener('mouseenter', function() {
        this.style.background = 'rgba(255,255,255,0.08)';
    });
    dialog.querySelector('.dev-warning-cancel').addEventListener('mouseleave', function() {
        this.style.background = 'transparent';
    });
    dialog.querySelector('.dev-warning-confirm').addEventListener('mouseenter', function() {
        this.style.background = '#6d28d9';
    });
    dialog.querySelector('.dev-warning-confirm').addEventListener('mouseleave', function() {
        this.style.background = '#7c3aed';
    });
}

function checkDevMode() {
    var wrap = document.getElementById('devOptionsBtnWrap');
    if (wrap) wrap.style.display = settings.devMode ? 'block' : 'none';
    var pageGrid = document.getElementById('settingsPageGrid');
    if (pageGrid) {
        var pageBtn = pageGrid.querySelector('#devOptionsBtn');
        if (pageBtn) pageBtn.style.display = settings.devMode ? '' : 'none';
    }
}

function updateDevOptionsPage() {
    var grid = document.getElementById('devOptionsGrid');
    if (!grid) return;
    var html = '<div class="setting-item fps-setting-main">' +
        '<div class="setting-info">' +
        '<div class="setting-name">显示实时帧率</div>' +
        '<div class="setting-desc">在屏幕左上角显示实时帧率</div>' +
        '</div>' +
        '<label class="toggle-switch"><input type="checkbox" id="showFPSToggle" ' + (settings.showFPS ? 'checked' : '') + '><span class="toggle-slider"></span></label>' +
        '</div>' +
        '<div class="fps-customize-panel' + (settings.fpsPanelExpanded ? ' expanded' : '') + '" id="fpsCustomizePanel">' +
        '<div class="fps-customize-item">' +
        '<label>字体颜色</label>' +
        '<input type="color" id="fpsColorPicker" value="' + (settings.fpsColor || '#00ff00') + '">' +
        '</div>' +
        '<div class="fps-customize-item">' +
        '<label>字体大小 <span id="fpsSizeVal">' + (settings.fpsSize || 16) + 'px</span></label>' +
        '<input type="range" id="fpsSizeSlider" min="10" max="40" value="' + (settings.fpsSize || 16) + '" step="1">' +
        '</div>' +
        '<div class="fps-customize-item">' +
        '<label>背景不透明度 <span id="fpsBgVal">' + Math.round((settings.fpsBgOpacity || 0) * 100) + '%</span></label>' +
        '<input type="range" id="fpsBgSlider" min="0" max="100" value="' + Math.round((settings.fpsBgOpacity || 0) * 100) + '" step="5">' +
        '</div>' +
        '</div>' +
        '<div class="setting-item">' +
        '<div class="setting-info">' +
        '<div class="setting-name">禁用所有动画</div>' +
        '<div class="setting-desc">全局禁用 CSS 过渡和动画效果</div>' +
        '</div>' +
        '<label class="toggle-switch"><input type="checkbox" id="disableAnimationsToggle" ' + (settings.disableAnimations ? 'checked' : '') + '><span class="toggle-slider"></span></label>' +
        '</div>' +
        '<div class="setting-item">' +
        '<div class="setting-info">' +
        '<div class="setting-name">显示元素边界</div>' +
        '<div class="setting-desc">为所有元素添加轮廓线，便于调试布局</div>' +
        '</div>' +
        '<label class="toggle-switch"><input type="checkbox" id="showBoundsToggle" ' + (settings.showElementBounds ? 'checked' : '') + '><span class="toggle-slider"></span></label>' +
        '</div>' +
        '<div class="setting-item">' +
        '<div class="setting-info">' +
        '<div class="setting-name">液态玻璃效果(暂未完善，警慎启用，可能会影响性能，后果自负)</div>' +
        '<div class="setting-desc">实验性功能，暂未完善，警慎启用，可能会影响性能，后果自负</div>' +
        '</div>' +
        '<label class="toggle-switch"><input type="checkbox" id="liquidGlassToggle" ' + (settings.liquidGlass ? 'checked' : '') + '><span class="toggle-slider"></span></label>' +
        '</div>' +
        '<div class="setting-item">' +
        '<div class="setting-info">' +
        '<div class="setting-name">导出设置数据</div>' +
        '<div class="setting-desc">将所有设置导出为 JSON 文件下载</div>' +
        '</div>' +
        '<button class="btn" id="exportSettingsBtn" style="width:auto;padding:6px 14px;font-size:13px;">导出</button>' +
        '</div>' +
        '<div class="setting-item">' +
        '<div class="setting-info">' +
        '<div class="setting-name">清除缓存数据</div>' +
        '<div class="setting-desc">清除所有本地存储数据（包括设置、歌单、历史记录）</div>' +
        '</div>' +
        '<button class="btn" id="clearCacheBtn" style="width:auto;padding:6px 14px;font-size:13px;background:rgba(255,80,80,0.2);border-color:rgba(255,80,80,0.3);">清除</button>' +
        '</div>' +
        '<div class="setting-item">' +
        '<div class="setting-info">' +
        '<div class="setting-name">localStorage 用量</div>' +
        '<div class="setting-desc" id="storageUsageDesc">计算中...</div>' +
        '</div>' +
        '<span style="font-size:13px;color:var(--text-secondary);" id="storageUsageVal">-</span>' +
        '</div>' +
        '<div class="setting-item">' +
        '<div class="setting-info">' +
        '<div class="setting-name">测试 Toast 通知</div>' +
        '<div class="setting-desc">依次触发 success / info / warning / error</div>' +
        '</div>' +
        '<button class="btn" id="testToastBtn" style="width:auto;padding:6px 14px;font-size:13px;">测试</button>' +
        '</div>' +
        '<div class="setting-item">' +
        '<div class="setting-info">' +
        '<div class="setting-name">重置引导提示</div>' +
        '<div class="setting-desc">清除所有引导标记，下次打开时重新显示提示</div>' +
        '</div>' +
        '<button class="btn" id="resetGuidesBtn" style="width:auto;padding:6px 14px;font-size:13px;">重置</button>' +
        '</div>' +
        '<div class="setting-item">' +
        '<div class="setting-info">' +
        '<div class="setting-name">强制显示公告</div>' +
        '<div class="setting-desc">重新弹出全局公告弹窗</div>' +
        '</div>' +
        '<button class="btn" id="forceAnnounceBtn" style="width:auto;padding:6px 14px;font-size:13px;">显示</button>' +
        '</div>' +
        '<div class="setting-item">' +
        '<div class="setting-info">' +
        '<div class="setting-name">关闭开发者模式</div>' +
        '<div class="setting-desc">关闭后开发者选项将被隐藏，需重新点击版本号5次开启</div>' +
        '</div>' +
        '<button class="btn" id="disableDevModeBtn" style="width:auto;padding:6px 14px;font-size:13px;background:rgba(255,80,80,0.2);border-color:rgba(255,80,80,0.3);">关闭</button>' +
        '</div>';
    grid.innerHTML = html;
    document.getElementById('showFPSToggle').addEventListener('change', function(e) {
        settings.showFPS = e.target.checked;
        saveSettings();
        applyShowFPS();
        var panel = document.getElementById('fpsCustomizePanel');
        if (panel) {
            if (settings.showFPS) { panel.classList.add('expanded'); settings.fpsPanelExpanded = true; }
            else { panel.classList.remove('expanded'); settings.fpsPanelExpanded = false; }
            saveSettings();
        }
        showToast('实时帧率' + (settings.showFPS ? '已开启' : '已关闭'), 'info');
    });
    var fpsSettingMain = grid.querySelector('.fps-setting-main');
    if (fpsSettingMain) {
        fpsSettingMain.addEventListener('click', function(e) {
            if (e.target.closest('.toggle-switch')) return;
            var panel = document.getElementById('fpsCustomizePanel');
            if (panel) {
                panel.classList.toggle('expanded');
                settings.fpsPanelExpanded = panel.classList.contains('expanded');
                saveSettings();
            }
        });
    }
    document.getElementById('fpsColorPicker').addEventListener('input', function(e) {
        settings.fpsColor = e.target.value;
        saveSettings();
        applyShowFPS();
    });
    document.getElementById('fpsSizeSlider').addEventListener('input', function(e) {
        settings.fpsSize = parseInt(e.target.value);
        document.getElementById('fpsSizeVal').textContent = settings.fpsSize + 'px';
        saveSettings();
        applyShowFPS();
    });
    document.getElementById('fpsBgSlider').addEventListener('input', function(e) {
        settings.fpsBgOpacity = parseInt(e.target.value) / 100;
        document.getElementById('fpsBgVal').textContent = Math.round(settings.fpsBgOpacity * 100) + '%';
        saveSettings();
        applyShowFPS();
    });
    document.getElementById('disableDevModeBtn').addEventListener('click', function() {
        settings.devMode = false;
        settings.showFPS = false;
        settings.fpsPanelExpanded = true;
        settings.disableAnimations = false;
        settings.showElementBounds = false;
        settings.liquidGlass = false;
        devClickCount = 5;
        saveSettings();
        applyShowFPS();
        applyDisableAnimations();
        applyShowBounds();
        applyLiquidGlass();
        checkDevMode();
        showToast('开发者模式已关闭', 'info');
        devOptionsModal.classList.remove('active');
    });
    document.getElementById('disableAnimationsToggle').addEventListener('change', function(e) {
        settings.disableAnimations = e.target.checked;
        saveSettings();
        applyDisableAnimations();
        showToast('动画' + (settings.disableAnimations ? '已禁用' : '已恢复'), 'info');
    });
    document.getElementById('showBoundsToggle').addEventListener('change', function(e) {
        settings.showElementBounds = e.target.checked;
        saveSettings();
        applyShowBounds();
        showToast('元素边界' + (settings.showElementBounds ? '已显示' : '已隐藏'), 'info');
    });
    document.getElementById('liquidGlassToggle').addEventListener('change', function(e) {
        settings.liquidGlass = e.target.checked;
        saveSettings();
        applyLiquidGlass();
        showToast('液态玻璃效果' + (settings.liquidGlass ? '已开启' : '已关闭'), 'info');
    });
    document.getElementById('exportSettingsBtn').addEventListener('click', function() {
        var exportData = {
            version: '26.24.5',
            exportTime: new Date().toISOString(),
            settings: settings,
            playlists: playlists,
            history: searchHistory,
            favorites: favoriteSongs
        };
        var blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'anysound-backup-' + new Date().toISOString().slice(0, 10) + '.json';
        a.click();
        URL.revokeObjectURL(url);
        showToast('设置数据已导出', 'success');
    });
    document.getElementById('clearCacheBtn').addEventListener('click', function() {
        if (confirm('确定要清除所有本地数据吗？\n\n这将删除所有设置、歌单、历史记录和收藏数据。\n此操作不可撤销！')) {
            localStorage.clear();
            showToast('所有缓存数据已清除，页面即将刷新', 'info');
            setTimeout(function() { location.reload(); }, 1000);
        }
    });
    function updateStorageUsage() {
        var total = 0;
        for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            total += key.length + (localStorage.getItem(key) || '').length;
        }
        var sizeKB = (total / 1024).toFixed(2);
        var desc = document.getElementById('storageUsageDesc');
        var val = document.getElementById('storageUsageVal');
        if (desc) desc.textContent = sizeKB + ' KB (' + localStorage.length + ' 个键)';
        if (val) val.textContent = sizeKB + ' KB';
    }
    updateStorageUsage();
    document.getElementById('testToastBtn').addEventListener('click', function() {
        var types = ['success', 'info', 'warning', 'error'];
        types.forEach(function(t, i) {
            setTimeout(function() {
                showToast('Test ' + t + ' toast', t);
            }, i * 800);
        });
    });
    document.getElementById('resetGuidesBtn').addEventListener('click', function() {
        var guideKeys = [];
        for (var i = 0; i < localStorage.length; i++) {
            var k = localStorage.key(i);
            if (k && k.indexOf('guide_') === 0) guideKeys.push(k);
        }
        guideKeys.forEach(function(k) { localStorage.removeItem(k); });
        showToast('已清除 ' + guideKeys.length + ' 个引导标记', 'success');
    });
    document.getElementById('forceAnnounceBtn').addEventListener('click', function() {
        devOptionsModal.classList.remove('active');
        setTimeout(function() {
            showAnnouncementModal();
        }, 300);
    });
}

function applyDisableAnimations() {
    if (settings.disableAnimations) {
        document.body.classList.add('no-animations');
    } else {
        document.body.classList.remove('no-animations');
    }
}

function applyShowBounds() {
    if (settings.showElementBounds) {
        document.body.classList.add('show-element-bounds');
    } else {
        document.body.classList.remove('show-element-bounds');
    }
}

function applyLiquidGlass() {
    if (settings.liquidGlass) {
        document.body.classList.add('liquid-glass-mode');
        document.querySelectorAll('.modal-content').forEach(function(el) { el.classList.add('lg-frame', 'lg-scroll'); });
        document.querySelectorAll('.btn, .control-btn, .play-pause-btn, .setting-item, .tab-btn, .close-btn, .player-mode-btn, .hamburger-menu').forEach(function(el) { el.classList.add('liquid-glass-pressable'); });
        document.querySelectorAll('.modal.active .modal-content').forEach(function(el) { el.classList.add('lg-animate-in'); });
        setTimeout(function () { if (window.refreshLiquidGlass) window.refreshLiquidGlass(); }, 100);
    } else {
        document.body.classList.remove('liquid-glass-mode');
        document.querySelectorAll('.modal-content').forEach(function(el) { el.classList.remove('lg-frame', 'lg-scroll', 'lg-animate-in'); });
        document.querySelectorAll('.btn, .control-btn, .play-pause-btn, .setting-item, .tab-btn, .close-btn, .player-mode-btn, .hamburger-menu').forEach(function(el) { el.classList.remove('liquid-glass-pressable'); });
    }
}

function showSuperPerformanceWarning() {
    var avg = Math.round(fpsMonitorData.samples.reduce(function(a, b) { return a + b; }, 0) / fpsMonitorData.samples.length);
    var overlay = document.createElement('div');
    overlay.className = 'super-perf-overlay';
    overlay.innerHTML = '<div class="super-perf-dialog">' +
        '<div class="super-perf-icon"><i class="fas fa-gauge-high"></i></div>' +
        '<h3>检测到性能问题</h3>' +
        '<p>当前设备平均帧率较低（<b>' + avg + ' FPS</b>），可能影响使用体验。</p>' +
        '<p>建议开启 <b>超性能模式</b> 以获得流畅体验。</p>' +
        '<div class="super-perf-actions">' +
        '<button class="btn btn-primary" id="enableSuperPerfBtn"><i class="fas fa-bolt"></i> 开启超性能模式</button>' +
        '<button class="btn btn-secondary" id="dismissSuperPerfBtn">暂不开启</button>' +
        '</div>' +
        '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) { overlay.remove(); }
    });
    overlay.querySelector('#enableSuperPerfBtn').addEventListener('click', function() {
        settings.superPerformance = true;
        saveSettings();
        applySuperPerformance();
        updateSettingsPage();
        if (typeof initFullscreenSettings === 'function') initFullscreenSettings();
        overlay.remove();
    });
    overlay.querySelector('#dismissSuperPerfBtn').addEventListener('click', function() {
        overlay.remove();
    });
}

function updateSettingsPage() {
    if (!settingsGrid) return;
    var isLargeScreenNow = window.innerWidth >= 1100;
    var largeScreenStatus = isLargeScreenNow ? '已启用（大屏幕）' : '未启用（非大屏幕）';

    var sectionStyle = 'margin-bottom:20px;';
    var sectionTitleStyle = 'font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-tertiary, #888);padding:0 4px 8px 4px;border-bottom:1px solid var(--glass-border);margin-bottom:10px;';

    var settingsHTML = '';

    // ========== 播放 ==========
    settingsHTML += '<div class="settings-section" style="' + sectionStyle + '">';
    settingsHTML += '<div class="settings-section-title" style="' + sectionTitleStyle + '"><i class="fas fa-play-circle" style="margin-right:6px;"></i>播放</div>';

    settingsHTML += '<div class="setting-group"><div class="setting-item setting-parent' + (settings.crossfadePanelExpanded ? ' expanded' : '') + '" id="crossfadeParent"><div class="setting-info"><div class="setting-name">无缝过渡(beta) <span class="setting-arrow"></span></div><div class="setting-desc">切换歌曲时淡出淡入，实现无缝衔接</div></div><label class="toggle-switch"><input type="checkbox" id="crossfadeToggle" ' + (settings.crossfade ? 'checked' : '') + '><span class="toggle-slider"></span></label></div><div class="sub-settings-panel' + (settings.crossfadePanelExpanded ? ' expanded' : '') + '" id="crossfadePanel"><div class="setting-item"><div class="setting-info"><div class="setting-name">无缝过渡时长</div><div class="setting-desc">无缝过渡的淡入淡出持续时间</div></div><select id="crossfadeDurationSelect" style="padding:4px 8px;border:none;background:var(--glass-bg);border-radius:10px;font-size:12px;"><option value="1500" ' + (settings.crossfadeDuration === 1500 ? 'selected' : '') + '>1.5 秒</option><option value="3000" ' + (settings.crossfadeDuration === 3000 ? 'selected' : '') + '>3 秒</option><option value="5000" ' + (settings.crossfadeDuration === 5000 ? 'selected' : '') + '>5 秒</option><option value="8000" ' + (settings.crossfadeDuration === 8000 ? 'selected' : '') + '>8 秒</option></select></div></div></div>';

    settingsHTML += '<div class="setting-item"><div class="setting-info"><div class="setting-name">封面切换动画</div><div class="setting-desc">切换歌曲时封面的过渡动画效果</div></div><select id="coverTransitionSelect" style="padding:4px 8px;border:none;background:var(--glass-bg);border-radius:10px;font-size:12px;"><option value="none" ' + (settings.coverTransition === 'none' ? 'selected' : '') + '>无动画</option><option value="fade" ' + (settings.coverTransition === 'fade' ? 'selected' : '') + '>淡入淡出</option><option value="slideH" ' + (settings.coverTransition === 'slideH' ? 'selected' : '') + '>水平滑动</option><option value="slideV" ' + (settings.coverTransition === 'slideV' ? 'selected' : '') + '>垂直滑动</option><option value="flip3d" ' + (settings.coverTransition === 'flip3d' ? 'selected' : '') + '>3D 翻转</option><option value="scaleBounce" ' + (settings.coverTransition === 'scaleBounce' ? 'selected' : '') + '>缩放弹入</option><option value="blur" ' + (settings.coverTransition === 'blur' ? 'selected' : '') + '>模糊过渡</option><option value="circleReveal" ' + (settings.coverTransition === 'circleReveal' ? 'selected' : '') + '>圆形扩散</option><option value="blinds" ' + (settings.coverTransition === 'blinds' ? 'selected' : '') + '>百叶窗</option><option value="rotateScale" ' + (settings.coverTransition === 'rotateScale' ? 'selected' : '') + '>旋转缩放</option><option value="skewSlide" ' + (settings.coverTransition === 'skewSlide' ? 'selected' : '') + '>斜切滑入</option></select></div>';

    settingsHTML += '<div class="setting-item"><div class="setting-info"><div class="setting-name">封面旋转</div><div class="setting-desc">播放时专辑封面旋转效果（圆形）</div></div><label class="toggle-switch"><input type="checkbox" id="coverRotationToggle" ' + (settings.coverRotation ? 'checked' : '') + '><span class="toggle-slider"></span></label></div>';

    settingsHTML += '<div class="setting-item"><div class="setting-info"><div class="setting-name">播放时自动全屏</div><div class="setting-desc">开始播放歌曲时自动进入全屏播放器</div></div><label class="toggle-switch"><input type="checkbox" id="autoFullscreenToggle" ' + (settings.autoFullscreen ? 'checked' : '') + '><span class="toggle-slider"></span></label></div>';

    settingsHTML += '<div class="setting-item"><div class="setting-info"><div class="setting-name">睡眠定时器</div><div class="setting-desc">设定时间后自动暂停播放，适合睡前使用</div></div><select id="sleepTimerSelect" style="padding:4px 8px;border:none;background:var(--glass-bg);border-radius:10px;font-size:12px;"><option value="0" ' + (settings.sleepTimer === 0 ? 'selected' : '') + '>关闭</option><option value="15" ' + (settings.sleepTimer === 15 ? 'selected' : '') + '>15 分钟</option><option value="30" ' + (settings.sleepTimer === 30 ? 'selected' : '') + '>30 分钟</option><option value="45" ' + (settings.sleepTimer === 45 ? 'selected' : '') + '>45 分钟</option><option value="60" ' + (settings.sleepTimer === 60 ? 'selected' : '') + '>60 分钟</option><option value="90" ' + (settings.sleepTimer === 90 ? 'selected' : '') + '>90 分钟</option><option value="120" ' + (settings.sleepTimer === 120 ? 'selected' : '') + '>120 分钟</option></select></div>';

    settingsHTML += '<div class="setting-item"><div class="setting-info"><div class="setting-name">默认音质</div><div class="setting-desc">选择默认播放和下载的音质</div></div><select id="qualityPreference" style="padding:4px 8px;border:none;background:var(--glass-bg);border-radius:10px;font-size:12px;"><option value="hires" ' + (settings.qualityPreference === 'hires' ? 'selected' : '') + '>母带音质优先</option><option value="lossless" ' + (settings.qualityPreference === 'lossless' ? 'selected' : '') + '>无损音质优先</option><option value="exhigh" ' + (settings.qualityPreference === 'exhigh' ? 'selected' : '') + '>极高音质优先</option><option value="higher" ' + (settings.qualityPreference === 'higher' ? 'selected' : '') + '>较高音质优先</option><option value="standard" ' + (settings.qualityPreference === 'standard' ? 'selected' : '') + '>标准音质优先</option></select></div>';

    settingsHTML += '<div class="setting-item"><div class="setting-info"><div class="setting-name">音量标准化</div><div class="setting-desc">自动平衡不同歌曲的音量差异，避免忽大忽小（此功能暂不可用）</div></div><label class="toggle-switch disabled"><input type="checkbox" id="volNormalizeToggle" disabled><span class="toggle-slider"></span></label></div>';

    settingsHTML += '</div>';

    // ========== 显示 ==========
    settingsHTML += '<div class="settings-section" style="' + sectionStyle + '">';
    settingsHTML += '<div class="settings-section-title" style="' + sectionTitleStyle + '"><i class="fas fa-palette" style="margin-right:6px;"></i>显示</div>';

    settingsHTML += '<div class="setting-item"><div class="setting-info"><div class="setting-name">暗色主题</div><div class="setting-desc">切换明亮/暗色主题模式</div></div><label class="toggle-switch"><input type="checkbox" id="darkThemeToggle" ' + (settings.darkTheme ? 'checked' : '') + '><span class="toggle-slider"></span></label></div>';

    settingsHTML += '<div class="setting-item"><div class="setting-info"><div class="setting-name">动画效果</div><div class="setting-desc">控制所有界面动画（加载、过渡、旋转等），关闭可提升性能</div></div><label class="toggle-switch"><input type="checkbox" id="animationToggle" ' + (settings.animations ? 'checked' : '') + '><span class="toggle-slider"></span></label></div>';

    settingsHTML += '<div class="setting-item"><div class="setting-info"><div class="setting-name">超性能模式 <span class="hd-badge" style="display:inline-block;font-size:8px;padding:1px 4px;margin-left:0;background:var(--accent);">NEW</span></div><div class="setting-desc">为低端设备极致优化，关闭所有非必要渲染和特效，大幅提升流畅度</div></div><label class="toggle-switch"><input type="checkbox" id="superPerformanceToggle" ' + (settings.superPerformance ? 'checked' : '') + '><span class="toggle-slider"></span></label></div>';

    settingsHTML += '<div class="setting-item"><div class="setting-info"><div class="setting-name">动态背景</div><div class="setting-desc">使用当前歌曲封面作为背景，亮色下也显示</div></div><label class="toggle-switch"><input type="checkbox" id="dynamicBackgroundToggle" ' + (settings.dynamicBackground ? 'checked' : '') + '><span class="toggle-slider"></span></label></div>';

    settingsHTML += '<div class="setting-item"><div class="setting-info"><div class="setting-name">显示歌词</div><div class="setting-desc">在全屏播放器中显示歌词</div></div><label class="toggle-switch"><input type="checkbox" id="showLyricsToggle" ' + (settings.showLyrics ? 'checked' : '') + '><span class="toggle-slider"></span></label></div>';

    settingsHTML += '<div class="setting-group"><div class="setting-item setting-parent' + (settings.floatingLyricsPanelExpanded ? ' expanded' : '') + '" id="floatingLyricsParent"><div class="setting-info"><div class="setting-name">浮空歌词 <span class="setting-arrow"></span></div><div class="setting-desc">在播放栏上方始终显示当前歌词和翻译</div></div><label class="toggle-switch"><input type="checkbox" id="floatingLyricsToggle" ' + (settings.floatingLyricsEnabled ? 'checked' : '') + '><span class="toggle-slider"></span></label></div><div class="sub-settings-panel' + (settings.floatingLyricsPanelExpanded ? ' expanded' : '') + '" id="floatingLyricsPanel"><div class="setting-item"><div class="setting-info"><div class="setting-name">文字颜色</div><div class="setting-desc">浮空歌词的文字颜色</div></div><input type="color" id="floatingLyricsColorPicker" value="' + (settings.floatingLyricsColor || '#ffffff') + '" style="width:40px;height:40px;border:none;background:transparent;cursor:pointer;flex-shrink:0;"></div><div class="setting-item"><div class="setting-info"><div class="setting-name">字体大小: ' + (settings.floatingLyricsSize || 18) + 'px</div><div class="setting-desc">浮空歌词的字体大小（12-36px）</div></div><input type="range" id="floatingLyricsSizeSlider" min="12" max="36" value="' + (settings.floatingLyricsSize || 18) + '" style="width:100px;flex-shrink:0;"></div><div class="setting-item"><div class="setting-info"><div class="setting-name">背景不透明度: ' + (settings.floatingLyricsBgOpacity || 0) + '%</div><div class="setting-desc">浮空歌词的背景不透明度</div></div><input type="range" id="floatingLyricsBgOpacitySlider" min="0" max="100" step="5" value="' + (settings.floatingLyricsBgOpacity || 0) + '" style="width:100px;flex-shrink:0;"></div><div class="setting-item"><div class="setting-info"><div class="setting-name">字体透明度: ' + (settings.floatingLyricsOpacity || 100) + '%</div><div class="setting-desc">浮空歌词文字的透明度</div></div><input type="range" id="floatingLyricsOpacitySlider" min="10" max="100" step="5" value="' + (settings.floatingLyricsOpacity || 100) + '" style="width:100px;flex-shrink:0;"></div><div class="setting-item"><div class="setting-info"><div class="setting-name">X轴偏移: ' + (settings.floatingLyricsX || 50) + '%</div><div class="setting-desc">浮空歌词的水平位置（0=左边，100=右边）</div></div><input type="range" id="floatingLyricsXSlider" min="0" max="100" step="1" value="' + (settings.floatingLyricsX || 50) + '" style="width:100px;flex-shrink:0;"></div><div class="setting-item"><div class="setting-info"><div class="setting-name">Y轴偏移: ' + (settings.floatingLyricsY || 0) + 'px</div><div class="setting-desc">浮空歌词的垂直位置（负值=上移，正值=下移）</div></div><input type="range" id="floatingLyricsYSlider" min="-200" max="200" step="5" value="' + (settings.floatingLyricsY || 0) + '" style="width:100px;flex-shrink:0;"></div><div class="setting-item" style="justify-content:center;padding:8px 0;"><button class="btn" id="resetFloatingLyricsBtn" style="width:auto;padding:8px 20px;font-size:13px;white-space:nowrap;border-radius:50px;background:var(--glass-bg);border:1px solid var(--glass-border);color:var(--text-primary);cursor:pointer;">恢复默认</button></div></div></div>';

    settingsHTML += '<div class="setting-item"><div class="setting-info"><div class="setting-name">主题颜色</div><div class="setting-desc">自定义主色调</div></div><div style="display:flex;align-items:center;gap:8px;"><input type="color" id="themeColorPicker" value="' + (settings.themeColor || '#7c3aed') + '" style="width:40px;height:40px;border:none;background:transparent;cursor:pointer;"><button class="btn" id="resetThemeColorBtn" style="width:auto;padding:6px 12px;font-size:12px;white-space:nowrap;">恢复默认</button></div></div>';

    settingsHTML += '<div class="setting-item"><div class="setting-info"><div class="setting-name">字体选择</div><div class="setting-desc">选择界面字体</div></div><select id="fontFamilySelect" style="padding:4px 8px;border:none;background:var(--glass-bg);border-radius:10px;font-size:12px;"><option value="Inter, system-ui, sans-serif" ' + (settings.fontFamily === 'Inter, system-ui, sans-serif' ? 'selected' : '') + '>Inter</option><option value="system-ui, -apple-system, sans-serif" ' + (settings.fontFamily === 'system-ui, -apple-system, sans-serif' ? 'selected' : '') + '>系统默认</option><option value="\'PingFang SC\', \'Microsoft YaHei\', sans-serif" ' + (settings.fontFamily === "'PingFang SC', 'Microsoft YaHei', sans-serif" ? 'selected' : '') + '>苹方/微软雅黑</option><option value="\'Noto Sans SC\', \'Microsoft YaHei\', sans-serif" ' + (settings.fontFamily === "'Noto Sans SC', 'Microsoft YaHei', sans-serif" ? 'selected' : '') + '>Noto Sans SC</option><option value="\'LXGW WenKai\', \'KaiTi\', serif" ' + (settings.fontFamily === "'LXGW WenKai', 'KaiTi', serif" ? 'selected' : '') + '>霞鹜文楷/楷体</option><option value="\'HarmonyOS Sans\', \'PingFang SC\', sans-serif" ' + (settings.fontFamily === "'HarmonyOS Sans', 'PingFang SC', sans-serif" ? 'selected' : '') + '>HarmonyOS Sans</option><option value="\'Courier New\', monospace" ' + (settings.fontFamily === "'Courier New', monospace" ? 'selected' : '') + '>等宽字体</option><option value="\'Georgia\', \'Times New Roman\', serif" ' + (settings.fontFamily === "'Georgia', 'Times New Roman', serif" ? 'selected' : '') + '>Georgia/宋体</option><option value="\'Comic Sans MS\', \'YouYuan\', cursive" ' + (settings.fontFamily === "'ComicSansLocal', 'YouYuanLocal', 'Comic Sans MS', cursive" ? 'selected' : '') + '>Comic Sans/幼圆</option></select></div>';

    settingsHTML += '<div class="setting-item setting-desktop-only"><div class="setting-info"><div class="setting-name">界面风格</div><div class="setting-desc">选择界面显示风格，简洁模式精简非核心元素与动画</div></div><select id="uiModeSelect" style="padding:4px 8px;border:none;background:var(--glass-bg);border-radius:10px;font-size:12px;"><option value="simple" ' + (settings.uiMode === 'simple' ? 'selected' : '') + '>简洁模式</option><option value="advanced" ' + (settings.uiMode === 'advanced' ? 'selected' : '') + '>高级模式</option></select></div>';

    settingsHTML += '<div class="setting-item setting-mobile-only"><div class="setting-info"><div class="setting-name">移动端安卓风格</div><div class="setting-desc">将移动端界面改为简洁的安卓 App 风格，含底部导航栏</div></div><label class="toggle-switch"><input type="checkbox" id="mobileAndroidStyleToggle" ' + (settings.mobileAndroidStyle ? 'checked' : '') + '><span class="toggle-slider"></span></label></div>';

    settingsHTML += '<div class="setting-item"><div class="setting-info"><div class="setting-name">大屏幕适配 <span class="hd-badge" style="display:inline-block;font-size:8px;padding:1px 4px;margin-left:0;">HD</span></div><div class="setting-desc">当前屏幕宽度：' + window.innerWidth + 'px，状态：' + largeScreenStatus + '</div></div><div style="font-size:12px;color:var(--primary);">' + (isLargeScreenNow ? '<i class="fas fa-check-circle"></i> HD模式已激活' : '<i class="fas fa-info-circle"></i> 调整窗口宽度≥1100px可启用HD模式') + '</div></div>';

    settingsHTML += '</div>';

    // ========== 数据 ==========
    settingsHTML += '<div class="settings-section" style="' + sectionStyle + '">';
    settingsHTML += '<div class="settings-section-title" style="' + sectionTitleStyle + '"><i class="fas fa-database" style="margin-right:6px;"></i>数据</div>';

    settingsHTML += '<div class="setting-item"><div class="setting-info"><div class="setting-name">记录播放历史</div><div class="setting-desc">自动记录播放过的歌曲</div></div><label class="toggle-switch"><input type="checkbox" id="historyEnabledToggle" ' + (settings.historyEnabled ? 'checked' : '') + '><span class="toggle-slider"></span></label></div>';

    settingsHTML += '<div class="setting-item"><div class="setting-info"><div class="setting-name">历史记录限制</div><div class="setting-desc">最多保存的播放历史数量</div></div><select id="historyLimitSelect" style="padding:4px 8px;border:none;background:var(--glass-bg);border-radius:10px;font-size:12px;"><option value="50" ' + (settings.historyLimit === 50 ? 'selected' : '') + '>50 条</option><option value="100" ' + (settings.historyLimit === 100 ? 'selected' : '') + '>100 条</option><option value="200" ' + (settings.historyLimit === 200 ? 'selected' : '') + '>200 条</option><option value="500" ' + (settings.historyLimit === 500 ? 'selected' : '') + '>500 条</option></select></div>';

    settingsHTML += '<div class="setting-group"><div class="setting-item setting-parent' + (settings.backupPanelExpanded ? ' expanded' : '') + '" id="backupParent"><div class="setting-info"><div class="setting-name">自动备份数据 <span class="setting-arrow"></span></div><div class="setting-desc">退出时自动备份账号数据到本地存储；可选择文件夹导出备份文件</div></div><label class="toggle-switch"><input type="checkbox" id="dataBackupToggle" ' + (settings.dataBackup ? 'checked' : '') + '><span class="toggle-slider"></span></label></div><div class="sub-settings-panel' + (settings.backupPanelExpanded ? ' expanded' : '') + '" id="backupPanel"><div class="setting-item"><div class="setting-info"><div class="setting-name">备份文件夹</div><div class="setting-desc" id="backupFolderDesc">' + (settings.backupFolderName ? '已选择文件夹：' + settings.backupFolderName + '（浏览器限制，仅显示文件夹名）' : '未选择，点击右侧按钮选择') + '</div></div><div style="display:flex;align-items:center;gap:8px;flex-shrink:0;"><button class="btn" id="selectBackupFolderBtn" style="width:auto;padding:6px 12px;font-size:12px;white-space:nowrap;">' + (settings.backupFolderName ? '更换文件夹' : '选择文件夹') + '</button><button class="btn" id="manualBackupBtn" style="width:auto;padding:6px 12px;font-size:12px;white-space:nowrap;' + (settings.backupFolderName ? '' : 'display:none;') + '">立即备份</button></div></div></div></div>';

    settingsHTML += '<div class="setting-item"><div class="setting-info"><div class="setting-name">记住页面位置(beta)</div><div class="setting-desc">关闭/刷新后恢复上次浏览的页面位置</div></div><label class="toggle-switch"><input type="checkbox" id="rememberLastPositionToggle" ' + (settings.rememberLastPosition ? 'checked' : '') + '><span class="toggle-slider"></span></label></div>';

    settingsHTML += '</div>';

    // ========== 其他 ==========
    settingsHTML += '<div class="settings-section" style="' + sectionStyle + '">';
    settingsHTML += '<div class="settings-section-title" style="' + sectionTitleStyle + '"><i class="fas fa-sliders-h" style="margin-right:6px;"></i>其他</div>';

    settingsHTML += '<div class="setting-item"><div class="setting-info"><div class="setting-name">触感(部分设备不支持)</div><div class="setting-desc">执行一些操作时设备震动</div></div><label class="toggle-switch"><input type="checkbox" id="vibrationToggle" ' + (settings.vibration ? 'checked' : '') + '><span class="toggle-slider"></span></label></div>';

    settingsHTML += '<div class="setting-item"><div class="setting-info"><div class="setting-name">网易云失败自动切换</div><div class="setting-desc">网易云音乐搜索失败时自动切换为酷我/酷狗搜索，关闭后弹窗确认</div></div><label class="toggle-switch"><input type="checkbox" id="autoSwitchOnNeteaseErrorToggle" ' + (settings.autoSwitchOnNeteaseError ? 'checked' : '') + '><span class="toggle-slider"></span></label></div>';

    settingsHTML += '</div>';

    settingsGrid.innerHTML = settingsHTML;

    var isAndroid = document.body.classList.contains('mobile-android-style');
    var settingsPageGrid = document.getElementById('settingsPageGrid');
    if (settingsPageGrid) {
        settingsPageGrid.innerHTML = settingsHTML;
    }
    if (isAndroid) {
        settingsGrid.innerHTML = '';
        if (settingsPageGrid) {
            settingsPageGrid.style.display = 'block';
            var pageDevBtn = settingsPageGrid.querySelector('#devOptionsBtn');
            if (pageDevBtn) {
                pageDevBtn.addEventListener('click', function() {
                    updateDevOptionsPage();
                    devOptionsModal.classList.add('active');
                });
            }
            var pageSettingsCloseBtn = settingsPageGrid.querySelector('#settingsCloseBtn');
            if (pageSettingsCloseBtn) {
                pageSettingsCloseBtn.style.display = 'none';
            }
        }
    } else {
        if (settingsPageGrid) {
            settingsPageGrid.style.display = 'none';
        }
    }

    // 绑定事件
    document.getElementById('crossfadeToggle').addEventListener('change', function(e) { settings.crossfade = e.target.checked; saveSettings(); showToast('无缝过渡' + (settings.crossfade ? '已开启' : '已关闭'), 'info'); var cp = document.getElementById('crossfadePanel'); var cpParent = document.getElementById('crossfadeParent'); if (cp && cpParent) { if (settings.crossfade) { cp.classList.add('expanded'); cpParent.classList.add('expanded'); } else { cp.classList.remove('expanded'); cpParent.classList.remove('expanded'); } settings.crossfadePanelExpanded = settings.crossfade; saveSettings(); } });
    document.getElementById('crossfadeDurationSelect').addEventListener('change', function(e) { settings.crossfadeDuration = parseInt(e.target.value); saveSettings(); showToast('过渡时长已设为 ' + (settings.crossfadeDuration / 1000) + ' 秒', 'info'); });
    document.getElementById('coverTransitionSelect').addEventListener('change', function(e) { settings.coverTransition = e.target.value; saveSettings(); var names = { none: '无动画', fade: '淡入淡出', slideH: '水平滑动', slideV: '垂直滑动', flip3d: '3D 翻转', scaleBounce: '缩放弹入', blur: '模糊过渡', circleReveal: '圆形扩散', blinds: '百叶窗', rotateScale: '旋转缩放', skewSlide: '斜切滑入' }; showToast('封面切换动画已设为「' + (names[settings.coverTransition] || settings.coverTransition) + '」', 'info'); });
    document.getElementById('vibrationToggle').addEventListener('change', function(e) { settings.vibration = e.target.checked; saveSettings(); showToast('震动反馈' + (settings.vibration ? '已开启' : '已关闭'), 'info'); });
    document.getElementById('darkThemeToggle').addEventListener('change', function(e) { settings.darkTheme = e.target.checked; saveSettings(); toggleTheme(); });
    document.getElementById('animationToggle').addEventListener('change', function(e) { settings.animations = e.target.checked; saveSettings(); if (settings.animations) { document.body.classList.remove('animations-disabled'); } else { document.body.classList.add('animations-disabled'); } showToast('动画效果' + (settings.animations ? '已开启' : '已关闭'), 'info'); });
    document.getElementById('superPerformanceToggle').addEventListener('change', function(e) { settings.superPerformance = e.target.checked; saveSettings(); applySuperPerformance(); showToast('超性能模式' + (settings.superPerformance ? '已开启，已为低端设备极致优化' : '已关闭'), 'info'); });
    document.getElementById('coverRotationToggle').addEventListener('change', function(e) { settings.coverRotation = e.target.checked; if (!settings.coverRotation) { nowPlayingCover.classList.remove('playing', 'cover-rotation'); fullscreenCover.classList.remove('playing', 'cover-rotation'); resetCoverAnimation(nowPlayingCover); resetCoverAnimation(fullscreenCover); } else { nowPlayingCover.classList.add('cover-rotation'); fullscreenCover.classList.add('cover-rotation'); if (isPlaying) { nowPlayingCover.classList.add('playing'); fullscreenCover.classList.add('playing'); } } saveSettings(); showToast('封面旋转' + (settings.coverRotation ? '已开启' : '已关闭'), 'info'); });
    document.getElementById('dynamicBackgroundToggle').addEventListener('change', function(e) { settings.dynamicBackground = e.target.checked; saveSettings(); if (!settings.dynamicBackground) { dynamicBackground.classList.remove('active'); fullscreenDynamicBg.classList.remove('active'); currentBackgroundUrl = '' } else if (currentIndex !== -1 && currentSongs[currentIndex]) { var song = currentSongs[currentIndex]; updateDynamicBackground(song.picurl); } showToast('动态背景' + (settings.dynamicBackground ? '已开启' : '已关闭'), 'info'); });
    document.getElementById('historyEnabledToggle').addEventListener('change', function(e) { settings.historyEnabled = e.target.checked; saveSettings(); showToast('播放历史记录' + (settings.historyEnabled ? '已开启' : '已关闭'), 'info'); });
    document.getElementById('showLyricsToggle').addEventListener('change', function(e) { settings.showLyrics = e.target.checked; saveSettings(); showToast('歌词显示' + (settings.showLyrics ? '已开启' : '已关闭'), 'info'); if (!settings.showLyrics) { if (floatingLyrics) { floatingLyrics.classList.remove('visible'); floatingLyrics.style.opacity = '0'; } lyricsContainer.style.display = 'none'; lyricsContainer.innerHTML = '<div class="no-lyrics"><i class="fas fa-microphone-alt"></i><p>歌词已关闭</p></div>'; } else { lyricsContainer.style.display = 'block'; if (currentIndex !== -1 && currentSongs[currentIndex]) { loadLyrics(currentSongs[currentIndex].id, currentSongs[currentIndex].platform); startLyricsRaf(); } else { lyricsContainer.innerHTML = '<div class="no-lyrics"><i class="fas fa-microphone-alt"></i><p>暂无歌词</p></div>'; } } });
    document.getElementById('floatingLyricsToggle').addEventListener('change', function(e) { settings.floatingLyricsEnabled = e.target.checked; saveSettings(); if (!settings.floatingLyricsEnabled) { if (floatingLyrics) { floatingLyrics.classList.remove('visible'); floatingLyrics.style.opacity = '0'; } } showToast('浮空歌词' + (settings.floatingLyricsEnabled ? '已开启' : '已关闭'), 'info'); var fp = document.getElementById('floatingLyricsPanel'); var fpParent = document.getElementById('floatingLyricsParent'); if (fp && fpParent) { if (settings.floatingLyricsEnabled) { fp.classList.add('expanded'); fpParent.classList.add('expanded'); } else { fp.classList.remove('expanded'); fpParent.classList.remove('expanded'); } settings.floatingLyricsPanelExpanded = settings.floatingLyricsEnabled; saveSettings(); } });
    document.getElementById('autoFullscreenToggle').addEventListener('change', function(e) { settings.autoFullscreen = e.target.checked; saveSettings(); showToast('播放时自动全屏' + (settings.autoFullscreen ? '已开启' : '已关闭'), 'info'); });
    document.getElementById('autoSwitchOnNeteaseErrorToggle').addEventListener('change', function(e) { settings.autoSwitchOnNeteaseError = e.target.checked; saveSettings(); showToast('网易云失败自动切换' + (settings.autoSwitchOnNeteaseError ? '已开启' : '已关闭'), 'info'); });
    document.getElementById('rememberLastPositionToggle').addEventListener('change', function(e) { settings.rememberLastPosition = e.target.checked; saveSettings(); if (settings.rememberLastPosition) { saveCurrentPagePosition(); showToast('记住页面位置已开启，下次打开将恢复当前位置', 'info'); } else { localStorage.removeItem('anyListenLastPagePosition'); showToast('记住页面位置已关闭', 'info'); } });
    document.getElementById('historyLimitSelect').addEventListener('change', function(e) { settings.historyLimit = parseInt(e.target.value); saveSettings(); if (playHistory.length > settings.historyLimit) { playHistory = playHistory.slice(0, settings.historyLimit); savePlayHistory(); updateHistoryCount(); updateHistoryPage(); } showToast('播放历史限制已设置为' + settings.historyLimit + '条', 'info'); });
    document.getElementById('dataBackupToggle').addEventListener('change', function(e) { settings.dataBackup = e.target.checked; saveSettings(); showToast('自动备份' + (settings.dataBackup ? '已开启' : '已关闭'), 'info'); var bp = document.getElementById('backupPanel'); var bpParent = document.getElementById('backupParent'); if (bp && bpParent) { if (settings.dataBackup) { bp.classList.add('expanded'); bpParent.classList.add('expanded'); } else { bp.classList.remove('expanded'); bpParent.classList.remove('expanded'); } settings.backupPanelExpanded = settings.dataBackup; saveSettings(); } });
    document.getElementById('selectBackupFolderBtn').addEventListener('click', selectBackupFolder);
    document.getElementById('manualBackupBtn').addEventListener('click', manualBackupToFolder);
    document.getElementById('sleepTimerSelect').addEventListener('change', function(e) { var minutes = parseInt(e.target.value); if (minutes > 0) { startSleepTimer(minutes); } else { cancelSleepTimer(); } });
    document.getElementById('qualityPreference').addEventListener('change', function(e) { settings.qualityPreference = e.target.value; currentQuality = settings.qualityPreference; qualityButtons.forEach(function(btn) { btn.classList.toggle('active', btn.dataset.quality === currentQuality); }); updateQualityLabel(); saveSettings(); showToast('默认音质已设置为' + qualityNames[currentQuality], 'info'); });
    document.getElementById('themeColorPicker').addEventListener('change', function(e) { settings.themeColor = e.target.value; applyThemeColor(settings.themeColor); saveSettings(); showToast('主题颜色已更新', 'success'); });
    document.getElementById('resetThemeColorBtn').addEventListener('click', function(e) { settings.themeColor = '#7c3aed'; applyThemeColor('#7c3aed'); saveSettings(); document.getElementById('themeColorPicker').value = '#7c3aed'; showToast('主题颜色已恢复默认', 'success'); });
    document.getElementById('fontFamilySelect').addEventListener('change', function(e) { settings.fontFamily = e.target.value; applyFontFamily(settings.fontFamily); saveSettings(); showToast('字体已更新', 'success'); });
    var uiModeSelect = document.getElementById('uiModeSelect');
    if (uiModeSelect) { uiModeSelect.addEventListener('change', function(e) { settings.uiMode = e.target.value; saveSettings(); applyUIMode(); showToast('界面风格已设为' + (settings.uiMode === 'simple' ? '简洁模式' : '高级模式'), 'info'); }); }
    var mobileAndroidStyleToggle = document.getElementById('mobileAndroidStyleToggle');
    if (mobileAndroidStyleToggle) { mobileAndroidStyleToggle.addEventListener('change', function(e) { settings.mobileAndroidStyle = e.target.checked; saveSettings(); applyUIMode(); showToast('移动端安卓风格' + (settings.mobileAndroidStyle ? '已开启' : '已关闭'), 'info'); }); }

    function setupSubPanel(parentId, panelId, settingKey) {
        var parent = document.getElementById(parentId);
        var panel = document.getElementById(panelId);
        if (!parent || !panel) return;
        parent.addEventListener('click', function(e) {
            if (e.target.closest('.toggle-switch') || e.target.closest('select') || e.target.closest('button') || e.target.closest('input')) return;
            var isExpanded = panel.classList.toggle('expanded');
            parent.classList.toggle('expanded', isExpanded);
            settings[settingKey] = isExpanded;
            saveSettings();
        });
    }
    setupSubPanel('crossfadeParent', 'crossfadePanel', 'crossfadePanelExpanded');
    setupSubPanel('backupParent', 'backupPanel', 'backupPanelExpanded');
    setupSubPanel('floatingLyricsParent', 'floatingLyricsPanel', 'floatingLyricsPanelExpanded');

    document.getElementById('floatingLyricsColorPicker').addEventListener('change', function(e) { settings.floatingLyricsColor = e.target.value; applyFloatingLyricsStyle(); saveSettings(); });
    document.getElementById('floatingLyricsSizeSlider').addEventListener('input', function(e) { settings.floatingLyricsSize = parseInt(e.target.value); applyFloatingLyricsStyle(); saveSettings(); var label = this.closest('.setting-item').querySelector('.setting-name'); if (label) label.textContent = '字体大小: ' + settings.floatingLyricsSize + 'px'; });
    document.getElementById('floatingLyricsBgOpacitySlider').addEventListener('input', function(e) { settings.floatingLyricsBgOpacity = parseInt(e.target.value); applyFloatingLyricsStyle(); saveSettings(); var label = this.closest('.setting-item').querySelector('.setting-name'); if (label) label.textContent = '背景不透明度: ' + settings.floatingLyricsBgOpacity + '%'; });
    document.getElementById('floatingLyricsOpacitySlider').addEventListener('input', function(e) { settings.floatingLyricsOpacity = parseInt(e.target.value); applyFloatingLyricsStyle(); saveSettings(); var label = this.closest('.setting-item').querySelector('.setting-name'); if (label) label.textContent = '字体透明度: ' + settings.floatingLyricsOpacity + '%'; });
    document.getElementById('floatingLyricsXSlider').addEventListener('input', function(e) { settings.floatingLyricsX = parseInt(e.target.value); applyFloatingLyricsStyle(); saveSettings(); var label = this.closest('.setting-item').querySelector('.setting-name'); if (label) label.textContent = 'X轴偏移: ' + settings.floatingLyricsX + '%'; });
    document.getElementById('floatingLyricsYSlider').addEventListener('input', function(e) { settings.floatingLyricsY = parseInt(e.target.value); applyFloatingLyricsStyle(); saveSettings(); var label = this.closest('.setting-item').querySelector('.setting-name'); if (label) label.textContent = 'Y轴偏移: ' + settings.floatingLyricsY + 'px'; });
    document.getElementById('resetFloatingLyricsBtn').addEventListener('click', function() {
        settings.floatingLyricsColor = '#ffffff';
        settings.floatingLyricsSize = 18;
        settings.floatingLyricsBgOpacity = 0;
        settings.floatingLyricsOpacity = 100;
        settings.floatingLyricsX = 50;
        settings.floatingLyricsY = 0;
        saveSettings();
        applyFloatingLyricsStyle();
        updateSettingsPage();
        showToast('浮空歌词已恢复默认', 'success');
    });
}

// ============================================
// 备份
// ============================================
var backupDB = null;
function openBackupDB() {
    return new Promise(function(resolve, reject) {
        if (backupDB) { resolve(backupDB); return; }
        var request = indexedDB.open('anyListenBackup', 1);
        request.onupgradeneeded = function(e) {
            var db = e.target.result;
            if (!db.objectStoreNames.contains('handles')) {
                db.createObjectStore('handles');
            }
        };
        request.onsuccess = function(e) { backupDB = e.target.result; resolve(backupDB); };
        request.onerror = function(e) { reject(e); };
    });
}

function storeBackupHandle(handle) {
    return openBackupDB().then(function(db) {
        return new Promise(function(resolve, reject) {
            var tx = db.transaction('handles', 'readwrite');
            tx.objectStore('handles').put(handle, 'backupDir');
            tx.oncomplete = function() { resolve(); };
            tx.onerror = function(e) { reject(e); };
        });
    });
}

function getBackupHandle() {
    return openBackupDB().then(function(db) {
        return new Promise(function(resolve, reject) {
            var tx = db.transaction('handles', 'readonly');
            var request = tx.objectStore('handles').get('backupDir');
            request.onsuccess = function() { resolve(request.result); };
            request.onerror = function(e) { reject(e); };
        });
    });
}

function clearBackupHandle() {
    return openBackupDB().then(function(db) {
        return new Promise(function(resolve, reject) {
            var tx = db.transaction('handles', 'readwrite');
            tx.objectStore('handles').delete('backupDir');
            tx.oncomplete = function() { resolve(); };
            tx.onerror = function(e) { reject(e); };
        });
    });
}

function buildBackupData() {
    return JSON.stringify({
        version: '26.24.5',
        backupDate: new Date().toISOString(),
        account: isLoggedIn ? (currentUser ? currentUser.username : '未知用户') : '未登录',
        favorites: favorites,
        playHistory: playHistory,
        playlists: playlists,
        settings: settings
    }, null, 2);
}

function selectBackupFolder() {
    if (!('showDirectoryPicker' in window)) {
        showToast('当前浏览器不支持选择文件夹，请使用 Chrome/Edge 浏览器', 'warning');
        downloadBackupFile();
        return;
    }
    window.showDirectoryPicker({ mode: 'readwrite' }).then(function(handle) {
        storeBackupHandle(handle).then(function() {
            settings.backupFolderName = handle.name;
            saveSettings();
            updateSettingsPage();
            showToast('备份文件夹已设置为：' + handle.name, 'success');
        }).catch(function() {
            showToast('保存文件夹信息失败', 'warning');
        });
    }).catch(function(err) {
        if (err.name !== 'AbortError') {
            showToast('选择文件夹失败：' + err.message, 'warning');
        }
    });
}

function manualBackupToFolder() {
    getBackupHandle().then(function(handle) {
        if (!handle) {
            showToast('请先选择备份文件夹', 'warning');
            return;
        }
        verifyPermission(handle, true).then(function() {
            var now = new Date();
            var filename = 'anyListen_backup_' + now.getFullYear() + 
                ('0' + (now.getMonth() + 1)).slice(-2) + 
                ('0' + now.getDate()).slice(-2) + '_' +
                ('0' + now.getHours()).slice(-2) + 
                ('0' + now.getMinutes()).slice(-2) + 
                ('0' + now.getSeconds()).slice(-2) + '.json';
            var data = buildBackupData();
            handle.getFileHandle(filename, { create: true }).then(function(fileHandle) {
                fileHandle.createWritable().then(function(writable) {
                    writable.write(data).then(function() {
                        writable.close();
                        showToast('备份已保存到文件夹 ' + handle.name + '：' + filename, 'success');
                    });
                });
            }).catch(function(err) {
                showToast('写入备份文件失败：' + err.message, 'warning');
            });
        }).catch(function() {
            showToast('文件夹权限已失效，请重新选择', 'warning');
            settings.backupFolderName = '';
            saveSettings();
            updateSettingsPage();
        });
    }).catch(function() {
        showToast('请先选择备份文件夹', 'warning');
    });
}

function verifyPermission(handle, readWrite) {
    return handle.queryPermission({ mode: readWrite ? 'readwrite' : 'read' }).then(function(result) {
        if (result === 'granted') return true;
        return handle.requestPermission({ mode: readWrite ? 'readwrite' : 'read' }).then(function(result) {
            return result === 'granted';
        });
    });
}

function downloadBackupFile() {
    var data = buildBackupData();
    var now = new Date();
    var filename = 'anyListen_backup_' + now.getFullYear() + 
        ('0' + (now.getMonth() + 1)).slice(-2) + 
        ('0' + now.getDate()).slice(-2) + '_' +
        ('0' + now.getHours()).slice(-2) + 
        ('0' + now.getMinutes()).slice(-2) + '.json';
    var blob = new Blob([data], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('备份文件已下载：' + filename, 'success');
}

// ============================================
// 播放列表管理
// ============================================
function loadPlaylists() { var saved = localStorage.getItem('anyListenPlaylists'); if (saved) playlists = JSON.parse(saved); }
function savePlaylists() { localStorage.setItem('anyListenPlaylists', JSON.stringify(playlists)); }
function findPlaylist(id) { for (var i = 0; i < playlists.length; i++) { if (playlists[i].id === id) return playlists[i]; } return null; }
function generateId() { return 'pl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6); }

function createPlaylist(name) {
    var playlist = { id: generateId(), name: name, songs: [], createdAt: Date.now() };
    playlists.push(playlist);
    savePlaylists();
    updatePlaylistsPage();
    return playlist;
}

function renamePlaylist(id, newName) {
    var pl = findPlaylist(id);
    if (pl) { pl.name = newName; savePlaylists(); updatePlaylistsPage(); updatePlaylistDetailPage(id); }
}

function deletePlaylist(id) {
    playlists = playlists.filter(function(p) { return p.id !== id; });
    savePlaylists();
    updatePlaylistsPage();
    if (currentPlaylistId === id) { currentPlaylistId = null; switchPage('playlists'); }
}

function addSongToPlaylist(playlistId, song) {
    var pl = findPlaylist(playlistId);
    if (!pl) return false;
    var exists = pl.songs.some(function(s) { return s.id === song.id; });
    if (exists) return false;
    pl.songs.push({ id: song.id, name: song.name, artistsname: song.artistsname, album: song.album, picurl: ensureHttpsUrl(song.picurl), platform: song.platform, kuwo_rid: song.kuwo_rid, addedAt: Date.now() });
    savePlaylists();
    updatePlaylistsPage();
    if (currentPlaylistId === playlistId) updatePlaylistDetailPage(playlistId);
    return true;
}

function removeSongFromPlaylist(playlistId, songId) {
    var pl = findPlaylist(playlistId);
    if (!pl) return;
    pl.songs = pl.songs.filter(function(s) { return s.id !== songId; });
    savePlaylists();
    updatePlaylistsPage();
    updatePlaylistDetailPage(playlistId);
}

function reorderPlaylistSongs(playlistId, fromIndex, toIndex) {
    var pl = findPlaylist(playlistId);
    if (!pl) return;
    var item = pl.songs.splice(fromIndex, 1)[0];
    pl.songs.splice(toIndex, 0, item);
    savePlaylists();
}

function flipAnimate(container, selector, oldRectsMap) {
    requestAnimationFrame(function() {
        var items = container.querySelectorAll(selector);
        items.forEach(function(item) {
            var id = item.dataset.id;
            var oldRect = oldRectsMap[id];
            if (!oldRect) return;
            var newRect = item.getBoundingClientRect();
            var deltaY = oldRect.top - newRect.top;
            var deltaX = oldRect.left - newRect.left;
            if (deltaX !== 0 || deltaY !== 0) {
                item.style.transition = 'none';
                item.style.transform = 'translate(' + deltaX + 'px, ' + deltaY + 'px)';
                item.offsetHeight;
                item.style.transition = 'transform 0.3s ease';
                item.style.transform = '';
            }
        });
    });
}

function reorderPlaylists(fromIndex, toIndex) {
    var item = playlists.splice(fromIndex, 1)[0];
    playlists.splice(toIndex, 0, item);
    savePlaylists();
    var oldRects = {};
    playlistsGrid.querySelectorAll('.playlist-card').forEach(function(c) { oldRects[c.dataset.id] = c.getBoundingClientRect(); });
    updatePlaylistsPage();
    flipAnimate(playlistsGrid, '.playlist-card', oldRects);
}

function updatePlaylistsPage() {
    if (!playlistsGrid || currentPage !== 'playlists') return;
    if (playlists.length === 0) {
        playlistsGrid.innerHTML = '<div class="empty-state"><i class="fas fa-list"></i><p>还没有播放列表</p><p style="font-size:12px;color:var(--text-secondary);">点击上方按钮创建第一个歌单</p></div>';
        return;
    }
    var html = '';
    var isEditing = playlistsGrid.classList.contains('edit-mode');
    playlists.forEach(function(pl, index) {
        html += '<div class="playlist-card" data-index="' + index + '" data-id="' + pl.id + '">';
        html += '<div class="playlist-card-icon"><i class="fas fa-music"></i></div>';
        html += '<div class="playlist-card-name">' + escapeHtml(pl.name) + '</div>';
        html += '<div class="playlist-card-count">' + pl.songs.length + ' 首歌曲</div>';
        if (isEditing) {
            html += '<div class="playlist-card-edit-actions">';
            html += '<button class="edit-move-btn edit-move-up" data-index="' + index + '" title="上移"><i class="fas fa-chevron-up"></i></button>';
            html += '<button class="edit-move-btn edit-move-down" data-index="' + index + '" title="下移"><i class="fas fa-chevron-down"></i></button>';
            html += '</div>';
        }
        html += '<div class="playlist-card-drag" title="拖拽排序"><i class="fas fa-grip-vertical"></i></div>';
        html += '</div>';
    });
    playlistsGrid.innerHTML = html;
    bindPlaylistCardClick();
    if (isEditing) {
        bindEditModeButtons();
    }
}

function bindPlaylistCardClick() {
    var cards = playlistsGrid.querySelectorAll('.playlist-card');
    cards.forEach(function(card) {
        card.addEventListener('click', function() {
            var id = card.dataset.id;
            if (id) openPlaylistDetail(id);
        });
    });
}

var playlistEditMode = false;

function togglePlaylistEditMode() {
    playlistEditMode = !playlistEditMode;
    var grid = playlistsGrid;
    var btn = document.getElementById('editPlaylistsBtn');
    if (playlistEditMode) {
        grid.classList.add('edit-mode');
        if (btn) btn.innerHTML = '<i class="fas fa-check"></i> 完成排序';
    } else {
        grid.classList.remove('edit-mode');
        if (btn) btn.innerHTML = '<i class="fas fa-sort"></i> 编辑排序';
    }
    updatePlaylistsPage();
}

function bindEditModeButtons() {
    var upButtons = playlistsGrid.querySelectorAll('.edit-move-up');
    var downButtons = playlistsGrid.querySelectorAll('.edit-move-down');
    upButtons.forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            var index = parseInt(btn.dataset.index);
            if (index > 0) {
                reorderPlaylists(index, index - 1);
            }
        });
    });
    downButtons.forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            var index = parseInt(btn.dataset.index);
            if (index < playlists.length - 1) {
                reorderPlaylists(index, index + 1);
            }
        });
    });
}

var playlistSongsEditMode = false;

function togglePlaylistSongsEditMode() {
    playlistSongsEditMode = !playlistSongsEditMode;
    var list = playlistDetailList;
    var btn = document.getElementById('editPlaylistSongsBtn');
    if (playlistSongsEditMode) {
        list.classList.add('edit-mode');
        if (btn) btn.innerHTML = '<i class="fas fa-check"></i> 完成排序';
    } else {
        list.classList.remove('edit-mode');
        if (btn) btn.innerHTML = '<i class="fas fa-sort"></i> 编辑排序';
    }
    updatePlaylistDetailPage(currentPlaylistId);
}

function bindSongEditModeButtons(playlistId) {
    var upButtons = playlistDetailList.querySelectorAll('.edit-move-up');
    var downButtons = playlistDetailList.querySelectorAll('.edit-move-down');
    upButtons.forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            var index = parseInt(btn.dataset.index);
            if (index > 0) {
                reorderPlaylistSongs(playlistId, index, index - 1);
                var oldRects = {};
                playlistDetailList.querySelectorAll('.song-item').forEach(function(i) { oldRects[i.dataset.id] = i.getBoundingClientRect(); });
                updatePlaylistDetailPage(playlistId);
                flipAnimate(playlistDetailList, '.song-item', oldRects);
            }
        });
    });
    downButtons.forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            var index = parseInt(btn.dataset.index);
            var pl = findPlaylist(playlistId);
            if (pl && index < pl.songs.length - 1) {
                reorderPlaylistSongs(playlistId, index, index + 1);
                var oldRects = {};
                playlistDetailList.querySelectorAll('.song-item').forEach(function(i) { oldRects[i.dataset.id] = i.getBoundingClientRect(); });
                updatePlaylistDetailPage(playlistId);
                flipAnimate(playlistDetailList, '.song-item', oldRects);
            }
        });
    });
}

// ===== 音质选择 =====

function openPlaylistDetail(id) {
    currentPlaylistId = id;
    switchPage('playlistDetail');
    updatePlaylistDetailPage(id);
}

function updatePlaylistDetailPage(id) {
    var pl = findPlaylist(id);
    if (!pl) return;
    playlistDetailName.textContent = pl.name;
    playlistDetailCount.textContent = pl.songs.length + ' 首歌曲';
    if (pl.songs.length === 0) {
        playlistDetailList.innerHTML = '<div class="empty-state"><i class="fas fa-music"></i><p>歌单中还没有歌曲</p></div>';
        return;
    }
    var isSongEditing = playlistDetailList.classList.contains('edit-mode');

    renderLazyCards(playlistDetailList, pl.songs, function(song, index) {
        var html = '<div class="song-item" data-index="' + index + '" data-id="' + song.id + '">';
        html += '<div class="song-index">' + (index + 1) + '</div>';
        html += '<img class="song-cover" src="' + (song.picurl || '') + '" onerror="this.style.display=\'none\'">';
        html += '<div class="song-info"><div class="song-name">' + escapeHtml(song.name) + '</div><div class="song-artist">' + escapeHtml(song.artistsname) + '</div></div>';
        html += '<div class="song-remove" onclick="event.stopPropagation(); removeSongFromPlaylist(\'' + id + '\', \'' + song.id + '\'); showToast(\'已从歌单中移除\', \'info\')"><i class="fas fa-times"></i></div>';
        if (isSongEditing) {
            html += '<div class="song-edit-actions">';
            html += '<button class="edit-move-btn edit-move-up" data-index="' + index + '" title="上移"><i class="fas fa-chevron-up"></i></button>';
            html += '<button class="edit-move-btn edit-move-down" data-index="' + index + '" title="下移"><i class="fas fa-chevron-down"></i></button>';
            html += '</div>';
        }
        html += '</div>';
        return html;
    }, function(item, song, index) {
        item.addEventListener('click', function(e) {
            if (batchMode) return;
            if (e.target.closest('.song-remove') || e.target.closest('.edit-move-btn')) return;
            playPlaylistSong(id, index);
        });
    });

    if (isSongEditing) {
        bindSongEditModeButtons(id);
    }
}

function playPlaylistSong(playlistId, index) {
    var pl = findPlaylist(playlistId);
    if (!pl) return;
    currentSongs = pl.songs.slice();
    currentIndex = index;
    playSong(pl.songs[index], index);
}

function showPlaylistModal(mode, playlistId) {
    playlistModal.classList.add('active');
    if (mode === 'create') {
        playlistModalTitle.textContent = '新建歌单';
        playlistNameInput.value = '';
        playlistNameInput.dataset.mode = 'create';
        playlistNameInput.dataset.id = '';
    } else if (mode === 'rename') {
        playlistModalTitle.textContent = '重命名歌单';
        var pl = findPlaylist(playlistId);
        playlistNameInput.value = pl ? pl.name : '';
        playlistNameInput.dataset.mode = 'rename';
        playlistNameInput.dataset.id = playlistId;
    }
    playlistNameInput.focus();
}

function hidePlaylistModal() {
    playlistModal.classList.remove('active');
    playlistNameInput.value = '';
}

function confirmPlaylistAction() {
    var name = playlistNameInput.value.trim();
    if (!name) { showToast('请输入歌单名称', 'warning'); return; }
    var mode = playlistNameInput.dataset.mode;
    if (mode === 'create') {
        createPlaylist(name);
        showToast('歌单「' + name + '」已创建', 'success');
    } else if (mode === 'rename') {
        renamePlaylist(playlistNameInput.dataset.id, name);
        showToast('歌单已重命名为「' + name + '」', 'success');
    }
    hidePlaylistModal();
}

function showAddToPlaylistModal(song) {
    pendingSongToAdd = song;
    addToPlaylistModal.classList.add('active');
    updatePlaylistSelectList();
}

function hideAddToPlaylistModal() {
    addToPlaylistModal.classList.remove('active');
    pendingSongToAdd = null;
}

function updatePlaylistSelectList() {
    if (!playlistSelectList) return;
    if (playlists.length === 0) {
        playlistSelectList.innerHTML = '<div class="empty-state"><i class="fas fa-list"></i><p>还没有播放列表</p></div>';
        return;
    }
    var html = '';
    playlists.forEach(function(pl) {
        var hasSong = pendingSongToAdd && pl.songs.some(function(s) { return s.id === pendingSongToAdd.id; });
        html += '<div class="playlist-select-item" onclick="addSongToPlaylist(\'' + pl.id + '\', pendingSongToAdd); hideAddToPlaylistModal(); showToast(\'' + (hasSong ? '歌曲已在歌单中' : '已添加到「' + pl.name + '」') + '\', \'' + (hasSong ? 'warning' : 'success') + '\')">';
        html += '<div class="playlist-select-icon"><i class="fas fa-music"></i></div>';
        html += '<div class="playlist-select-info"><div class="playlist-select-name">' + escapeHtml(pl.name) + '</div><div class="playlist-select-count">' + pl.songs.length + ' 首歌曲</div></div>';
        if (hasSong) html += '<div class="playlist-select-added">已添加</div>';
        html += '</div>';
    });
    playlistSelectList.innerHTML = html;
}

// ============================================
// 睡眠定时器
// ============================================
var sleepTimerInterval = null;
var sleepTimerEndTime = 0;

function startSleepTimer(minutes) {
    cancelSleepTimer(true);
    settings.sleepTimer = minutes;
    saveSettings();
    sleepTimerEndTime = Date.now() + minutes * 60 * 1000;
    sleepTimerIndicator.style.display = 'flex';
    updateSleepTimerDisplay();
    updateSettingsPage();
    sleepTimerInterval = setInterval(function() {
        var remaining = sleepTimerEndTime - Date.now();
        if (remaining <= 0) {
            cancelSleepTimer();
            if (isPlaying) { audioPlayer.pause(); isPlaying = false; playIcon.className = 'fas fa-play'; fullscreenPlayIcon.className = 'fas fa-play'; nowPlayingCover.classList.remove('playing'); fullscreenCover.classList.remove('playing'); updateMediaSessionPlaybackState(); }
            showToast('睡眠定时已到，播放已暂停', 'info');
            settings.sleepTimer = 0;
            saveSettings();
            updateSettingsPage();
            return;
        }
        updateSleepTimerDisplay();
    }, 1000);
    showToast('睡眠定时已开启（' + minutes + ' 分钟后暂停）', 'info');
}

function cancelSleepTimer(skipUpdate) {
    if (sleepTimerInterval) { clearInterval(sleepTimerInterval); sleepTimerInterval = null; }
    sleepTimerIndicator.style.display = 'none';
    sleepTimerEndTime = 0;
    settings.sleepTimer = 0;
    saveSettings();
    if (!skipUpdate) updateSettingsPage();
}

function updateSleepTimerDisplay() {
    var remaining = Math.max(0, sleepTimerEndTime - Date.now());
    var mins = Math.floor(remaining / 60000);
    var secs = Math.floor((remaining % 60000) / 1000);
    sleepTimerRemaining.textContent = (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs;
}

// ============================================
// 键盘快捷键
// ============================================
function initKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        var tag = document.activeElement.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (e.key === ' ' || e.code === 'Space') {
            e.preventDefault();
            togglePlayPause();
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            if (settings.playMode === 'random') { playRandomMusic(); } else { prevSong(); }
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            if (settings.playMode === 'random') { playRandomMusic(); } else { nextSong(); }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            volume = Math.min(1, volume + 0.05);
            audioPlayer.volume = volume;
            updateVolumeUI();
            showToast('音量: ' + Math.round(volume * 100) + '%', 'info');
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            volume = Math.max(0, volume - 0.05);
            audioPlayer.volume = volume;
            updateVolumeUI();
            showToast('音量: ' + Math.round(volume * 100) + '%', 'info');
        } else if (e.key === 'm' || e.key === 'M') {
            e.preventDefault();
            if (volume > 0) { lastVolume = volume; volume = 0; } else { volume = lastVolume || 0.5; }
            audioPlayer.volume = volume;
            updateVolumeUI();
            showToast(volume === 0 ? '已静音' : '已取消静音', 'info');
        }
    });
}
var lastVolume = 0.5;

// ============================================
// 音量标准化
// ============================================
var audioCtx = null;
var sourceNode = null;
var compressorNode = null;

function initVolNormalize() {
    if (!settings.volNormalize) return;
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            sourceNode = audioCtx.createMediaElementSource(audioPlayer);
            compressorNode = audioCtx.createDynamicsCompressor();
            compressorNode.threshold.value = -24;
            compressorNode.knee.value = 30;
            compressorNode.ratio.value = 12;
            compressorNode.attack.value = 0.003;
            compressorNode.release.value = 0.25;
            sourceNode.connect(compressorNode);
            compressorNode.connect(audioCtx.destination);
        }
    } catch (e) {}
}

function destroyVolNormalize() {
    try {
        if (compressorNode) { compressorNode.disconnect(); compressorNode = null; }
        if (sourceNode) { sourceNode.disconnect(); sourceNode = null; }
        if (audioCtx) { audioCtx.close(); audioCtx = null; }
    } catch (e) {}
}

function toggleVolNormalize() {
    settings.volNormalize = !settings.volNormalize;
    saveSettings();
    if (settings.volNormalize) {
        initVolNormalize();
        showToast('音量标准化已开启', 'info');
    } else {
        destroyVolNormalize();
        showToast('音量标准化已关闭', 'info');
    }
}
function loadFavorites() { var saved = localStorage.getItem('anyListenFavorites'); if (saved) favorites = JSON.parse(saved); }
function saveFavorites() { localStorage.setItem('anyListenFavorites', JSON.stringify(favorites)); updateFavoritesCount(); updateFavoritesPage(); }
function updateFavoritesCount() {
    var count = favorites.length;
    favoritesCount.textContent = count;
    totalFavorites.textContent = count;
    var total = 0;
    favorites.forEach(function(song) { total += song.duration || 0; });
    var minutes = Math.floor(total / 60000);
    var seconds = Math.floor((total % 60000) / 1000).toString().padStart(2, '0');
    totalDuration.textContent = minutes + ':' + seconds;
}
function addToFavorites(song) {
    if (favorites.some(function(f) { return String(f.id) === String(song.id); })) { showToast('此歌曲已在收藏中', 'warning'); return false; }
    favorites.unshift(song);
    saveFavorites();
    showToast('已添加 "' + song.name + '" 到收藏', 'success');
    return true;
}
function removeFromFavorites(id) {
    var index = favorites.findIndex(function(s) { return String(s.id) === String(id); });
    if (index !== -1) { var name = favorites[index].name; favorites.splice(index, 1); saveFavorites(); showToast('已从收藏移除 "' + name + '"', 'info'); }
}
function clearFavorites() {
    if (favorites.length === 0) { showToast('收藏列表已为空', 'warning'); return; }
    if (confirm('确定要清空所有收藏歌曲吗？共 ' + favorites.length + ' 首歌曲，清除后无法恢复')) { favorites = []; saveFavorites(); showToast('已清空所有收藏歌曲', 'success'); }
}
function exportFavorites() {
    if (favorites.length === 0) { showToast('收藏列表为空，无法导出', 'warning'); return; }
    var data = { version: '26.24.5', exportDate: new Date().toISOString(), favorites: favorites, totalCount: favorites.length };
    var blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = 'anylisten_favorites_' + new Date().toISOString().slice(0,10) + '.json'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    showToast('已导出 ' + favorites.length + ' 首收藏歌曲', 'success');
}
function handleImportFavorites(event) {
    var file = event.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
        try {
            var imported = JSON.parse(e.target.result);
            if (!imported.favorites || !Array.isArray(imported.favorites)) { showToast('导入失败：数据格式不正确', 'error'); return; }
            if (imported.version && imported.version !== '26.24.5' && !confirm('导入的数据版本为 ' + imported.version + '，当前版本为 26.24.5，继续导入可能不兼容，是否继续？')) return;
            if (confirm('确定要导入 ' + imported.favorites.length + ' 首收藏歌曲吗？\n这将添加到现有收藏列表的末尾。')) {
                imported.favorites.forEach(function(song) { if (!favorites.some(function(f) { return String(f.id) === String(song.id); })) favorites.push(song); });
                saveFavorites();
                showToast('已成功导入 ' + imported.favorites.length + ' 首收藏歌曲', 'success');
                importFavoritesFile.value = ''
            }
        } catch (error) { showToast('导入失败：数据解析错误', 'error'); }
    };
    reader.readAsText(file);
}

// ============================================
// 播放历史
// ============================================
function loadPlayHistory() { var saved = localStorage.getItem('anyListenHistory'); if (saved) playHistory = JSON.parse(saved); }
function savePlayHistory() { localStorage.setItem('anyListenHistory', JSON.stringify(playHistory)); updateHistoryCount(); if (currentPage === 'history') updateHistoryPage(); }
function updateHistoryCount() {
    var count = playHistory.length;
    historyCount.textContent = count;
    totalHistory.textContent = count;
    var total = 0;
    playHistory.forEach(function(record) { if (record.song && record.song.duration) total += record.song.duration; });
    var minutes = Math.floor(total / 60000);
    var seconds = Math.floor((total % 60000) / 1000).toString().padStart(2, '0');
    totalHistoryDuration.textContent = minutes + ':' + seconds;
}
function addToHistory(song) {
    if (!settings.historyEnabled) return;
    var existingIndex = playHistory.findIndex(function(h) { return String(h.song.id) === String(song.id); });
    if (existingIndex !== -1) {
        var record = playHistory[existingIndex];
        playHistory.splice(existingIndex, 1);
        record.lastPlayed = new Date().toISOString();
        record.playCount = (record.playCount || 1) + 1;
        playHistory.unshift(record);
    } else {
        playHistory.unshift({ song: song, firstPlayed: new Date().toISOString(), lastPlayed: new Date().toISOString(), playCount: 1 });
    }
    if (playHistory.length > settings.historyLimit) playHistory = playHistory.slice(0, settings.historyLimit);
    localStorage.setItem('anyListenHistory', JSON.stringify(playHistory));
    updateHistoryCount();
    if (currentPage === 'history') updateHistoryPage();
}
function updateHistoryPage() {
    if (!historyList) return;
    if (playHistory.length === 0) {
        historyList.innerHTML = '<div class="empty-state"><i class="fas fa-history"></i><h3>暂无播放历史</h3><p>开始播放歌曲后，这里会显示您的播放记录</p></div>';
        return;
    }
    var historySongs = playHistory.map(function(record) { return { ...record.song, historyInfo: { firstPlayed: record.firstPlayed, lastPlayed: record.lastPlayed, playCount: record.playCount } }; });
    displayHistoryResults(historySongs, historyList);
}
function clearHistory() {
    if (playHistory.length === 0) { showToast('播放历史已为空', 'warning'); return; }
    if (confirm('确定要清空所有播放历史吗？共 ' + playHistory.length + ' 条记录，清除后无法恢复')) { playHistory = []; savePlayHistory(); updateHistoryPage(); showToast('已清空所有播放历史', 'success'); }
}
function exportHistory() {
    if (playHistory.length === 0) { showToast('播放历史为空，无法导出', 'warning'); return; }
    var data = { version: '26.24.5', exportDate: new Date().toISOString(), history: playHistory, totalCount: playHistory.length };
    var blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = 'anylisten_history_' + new Date().toISOString().slice(0,10) + '.json'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    showToast('已导出 ' + playHistory.length + ' 条播放历史', 'success');
}
function handleImportHistory(event) {
    var file = event.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
        try {
            var imported = JSON.parse(e.target.result);
            if (!imported.history || !Array.isArray(imported.history)) { showToast('导入失败：数据格式不正确', 'error'); return; }
            if (imported.version && imported.version !== '26.24.5' && !confirm('导入的数据版本为 ' + imported.version + '，当前版本为 26.24.5，继续导入可能不兼容，是否继续？')) return;
            if (confirm('确定要导入 ' + imported.history.length + ' 条播放历史吗？\n这将添加到现有历史记录的末尾。')) {
                imported.history.forEach(function(record) { if (!playHistory.some(function(h) { return String(h.song.id) === String(record.song.id); })) playHistory.push(record); });
                if (playHistory.length > settings.historyLimit) playHistory = playHistory.slice(0, settings.historyLimit);
                savePlayHistory();
                showToast('已成功导入 ' + imported.history.length + ' 条播放历史', 'success');
                importHistoryFile.value = ''
            }
        } catch (error) { showToast('导入失败：数据解析错误', 'error'); }
    };
    reader.readAsText(file);
}

// ============================================
// 热歌榜 & 排行榜
// ============================================
async function loadHotSongsForHome() {
    try {
        showLoading(trendingList, '正在载入热歌榜精选...');
        var response = await fetch('https://node.api.xfabe.com/api/wangyi/musicChart?list=热歌榜');
        if (!response.ok) throw new Error('获取热歌榜失败');
        var data = await response.json();
        if (data.code !== 200 || !data.data) throw new Error('未找到热歌榜数据');
        var songs = data.data.songs || [];
        songs.forEach(function(s) { s.platform = 'netease'; s.picurl = ensureHttpsUrl(s.picurl || ''); });
        var limited = songs.slice(0, 12);
        displayResults(limited, trendingList, 'home');
        hideError();
        hidePageLoader();
        setTimeout(function() { showToast('已载入' + limited.length + '首热歌榜精选歌曲', 'success'); }, 500);
    } catch (error) {
        showToast('热歌榜载入失败', 'error');
        console.error(error);
        displayEmptyResults(trendingList, '热歌榜载入失败', '请检查网络连接后重试');
        hidePageLoader();
    }
}

async function loadChartByType(type) {
    type = type || currentChartType;
    try {
        currentChartType = type;
        document.querySelectorAll('.chart-tab').forEach(function(tab) { tab.classList.toggle('active', tab.dataset.type === type); });
        showLoading(hotSongList, '正在加载' + type + '...');
        var response = await fetch('https://node.api.xfabe.com/api/wangyi/musicChart?list=' + encodeURIComponent(type));
        if (!response.ok) throw new Error('获取排行榜失败');
        var data = await response.json();
        if (data.code !== 200 || !data.data) throw new Error('未找到榜单数据');
        var chartData = data.data;
        if (chartData.listImg) {
            chartCover.src = chartData.listImg;
            chartCover.onload = function() { chartCover.classList.add('loaded'); };
            chartCover.onerror = function() { chartCover.src = '' };
        } else chartCover.src = ''
        chartInfo.innerHTML = '<h2>' + escapeHtml(chartData.listName || type) + '</h2><p>' + escapeHtml(chartData.listDesc || '网易云音乐官方榜单，每日更新') + '</p>';
        var chartSongs = chartData.songs || [];
        chartSongs.forEach(function(s) { s.platform = 'netease'; s.picurl = ensureHttpsUrl(s.picurl || ''); });
        currentSongs = chartSongs;
        displayHotSongList(currentSongs);
        hideError();
        showToast('已载入' + currentSongs.length + '首' + type + '歌曲', 'success');
    } catch (error) {
        showToast(type + '载入失败', 'error');
        console.error(error);
        displayEmptyHotSongList(type + '载入失败', '请检查网络连接后重试');
    }
}

function displayHotSongList(songs) {
    if (!songs || songs.length === 0) {
        displayEmptyHotSongList('暂无榜单数据', '请稍后重试');
        return;
    }

    renderLazyCards(hotSongList, songs, function(song, index) {
        var minutes = Math.floor(song.duration / 60000);
        var seconds = Math.floor((song.duration % 60000) / 1000).toString().padStart(2, '0');
        var isFavorited = favorites.some(function(f) { return String(f.id) === String(song.id); });
        var hasCover = song.picurl && song.picurl.trim() !== '';
        return '<div class="song-item" data-index="' + index + '" style="animation-delay: ' + (index * 0.05) + 's;">' +
            '<div class="song-index">' + (index + 1) + '</div>' +
            '<div class="song-item-cover-wrapper">' +
                (hasCover ? '<img src="' + song.picurl + '" alt="" class="song-item-cover" onload="this.classList.add(\'loaded\')" onerror="this.onerror=null; this.style.display=\'none\'">' : '<div class="song-item-cover-placeholder"><i class="fas fa-music"></i></div>') +
            '</div>' +
            '<div class="song-item-details">' +
                '<div class="song-item-title">' + escapeHtml(song.name) + '</div>' +
                '<div class="song-item-artist">' + escapeHtml(song.artistsname) + '</div>' +
            '</div>' +
            '<div class="song-item-duration">' + minutes + ':' + seconds + '</div>' +
            '<div class="song-actions">' +
                '<button class="action-btn play" data-index="' + index + '"><i class="fas fa-play"></i></button>' +
                '<button class="action-btn add-to-playlist" data-id="' + song.id + '" data-name="' + escapeAttr(song.name) + '" data-artist="' + escapeAttr(song.artistsname) + '" data-album="' + escapeAttr(song.album || '') + '" data-pic="' + escapeAttr(song.picurl || '') + '" data-platform="' + song.platform + '" data-kuwo-rid="' + (song.kuwo_rid || '') + '"><i class="fas fa-plus"></i></button>' +
                '<button class="action-btn favorite ' + (isFavorited ? 'active' : '') + '" data-id="' + song.id + '"><i class="fas ' + (isFavorited ? 'fa-heart' : 'fa-heart') + '"></i></button>' +
            '</div>' +
        '</div>';
    }, function(item, song, index) {
        bindSongItemEvents(item, song, index, songs);
    });
}

function bindSongItemEvents(item, song, index, songs) {
    item.addEventListener('click', function(e) {
        if (batchMode && (e.target.closest('.batch-checkbox') || e.target.closest('.song-card'))) return;
        if (!e.target.closest('.song-actions')) {
            playSong(song, index);
        }
    });
    var playBtn = item.querySelector('.action-btn.play');
    if (playBtn) {
        playBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            playSong(song, index);
        });
    }
    var favBtn = item.querySelector('.action-btn.favorite');
    if (favBtn) {
        favBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            var id = String(favBtn.dataset.id);
            if (favBtn.classList.contains('active')) {
                removeFromFavorites(id);
                favBtn.classList.remove('active');
            } else {
                if (addToFavorites(song)) {
                    favBtn.classList.add('active');
                }
            }
        });
    }
    var plBtn = item.querySelector('.action-btn.add-to-playlist');
    if (plBtn) {
        plBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            showAddToPlaylistModal({
                id: plBtn.dataset.id,
                name: plBtn.dataset.name,
                artistsname: plBtn.dataset.artist,
                album: plBtn.dataset.album,
                picurl: plBtn.dataset.pic,
                platform: plBtn.dataset.platform,
                kuwo_rid: plBtn.dataset.kuwoRid
            });
        });
    }
}

function displayEmptyHotSongList(title, message) {
    hotSongList.innerHTML = '<div class="empty-state"><i class="fas fa-fire"></i><h3>' + title + '</h3><p>' + message + '</p><button class="btn" id="retryHotlistBtn" style="width:auto;padding:8px 16px;margin-top:15px;"><i class="fas fa-redo"></i><span>重新载入</span></button></div>';
    document.getElementById('retryHotlistBtn')?.addEventListener('click', function() { loadChartByType(currentChartType); });
}

// ============================================
// 搜索
// ============================================
function loadSearchHistory() {
    var saved = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (saved) try { searchHistory = JSON.parse(saved); } catch(e) { searchHistory = []; }
}
function saveSearchHistory() {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(searchHistory));
}
function addSearchHistory(query) {
    if (!query.trim()) return;
    query = query.trim();
    searchHistory = searchHistory.filter(function(item) { return item !== query; });
    searchHistory.unshift(query);
    if (searchHistory.length > 20) searchHistory = searchHistory.slice(0, 20);
    saveSearchHistory();
    renderSearchHistory();
}
function renderSearchHistory() {
    var list = document.getElementById('searchHistoryList');
    var mobileList = document.getElementById('mobileSearchHistoryList');
    if (searchHistory.length === 0) {
        if (list) list.innerHTML = '<div class="search-history-empty">暂无搜索历史</div>';
        if (mobileList) mobileList.innerHTML = '<div class="search-history-empty">暂无搜索历史</div>';
        return;
    }
    var html = searchHistory.map(function(item) { return '<div class="search-history-item" data-query="' + escapeHtml(item) + '"><span class="search-history-text">' + escapeHtml(item) + '</span><button class="search-history-delete" data-query="' + escapeHtml(item) + '"><i class="fas fa-times"></i></button></div>'; }).join('');
    if (list) list.innerHTML = html;
    if (mobileList) mobileList.innerHTML = html;
    
    function bindHistoryEvents(container) {
        if (!container) return;
        container.querySelectorAll('.search-history-item').forEach(function(el) {
            el.addEventListener('click', function(e) {
                if (e.target.closest('.search-history-delete')) return;
                var query = el.dataset.query;
                if (navSearchInput) { navSearchInput.value = query; performNavSearch(); }
            });
        });
        container.querySelectorAll('.search-history-delete').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var query = btn.dataset.query;
                searchHistory = searchHistory.filter(function(item) { return item !== query; });
                saveSearchHistory();
                renderSearchHistory();
                showToast('已删除搜索记录', 'info');
            });
        });
    }
    
    bindHistoryEvents(list);
    bindHistoryEvents(mobileList);
}
function showNavSearchDropdown() {
    if (navSearchDropdown) navSearchDropdown.classList.add('show');
    renderSearchHistory();
}
function hideNavSearchDropdown() {
    if (navSearchDropdown) navSearchDropdown.classList.remove('show');
}
function showMobileSearchHistory() {
    if (mobileSearchHistoryDropdown) mobileSearchHistoryDropdown.classList.add('show');
    renderSearchHistory();
}
function hideMobileSearchHistory() {
    if (mobileSearchHistoryDropdown) mobileSearchHistoryDropdown.classList.remove('show');
}
function clearSearchHistoryAll() {
    if (searchHistory.length === 0) { showToast('搜索历史已为空', 'info'); return; }
    searchHistory = [];
    saveSearchHistory();
    renderSearchHistory();
    showToast('搜索历史已清空', 'success');
}

async function performNavSearch() {
    var query = navSearchInput.value.trim();
    if (!query) { showToast('请输入搜索关键词', 'warning'); return; }
    addSearchHistory(query);
    if (searchInput) searchInput.value = query;
    await performSearchInternal(query);
}

async function performSearch() {
    if (batchMode) exitBatchMode();
    var query = searchInput.value.trim();
    if (!query) { showToast('请输入搜索关键词', 'warning'); return; }
    addSearchHistory(query);
    if (navSearchInput) navSearchInput.value = query;
    await performSearchInternal(query);
}

async function performSearchInternal(query) {
    if (searchInProgress) { showToast('正在搜索中，请稍候', 'warning'); return; }
    switchPage('search');
    searchInProgress = true;
    showLoading(resultsList, '正在搜索中...');
    try {
        if (currentPlatform === 'all') {
            resultsCount.textContent = '正在聚合搜索...';
            var allSongs = [];
            var kuwoSongs = [];
            var neteaseSongs = [];
            try {
                var kwResp = await secureFetch('http://kuwo.bfmzdx.cn/kuwo/search/searchMusicBykeyWord?key=' + encodeURIComponent(query));
                if (kwResp.ok) {
                    var kwData = await kwResp.json();
                    if (kwData.data && kwData.data.list && kwData.data.list.length > 0) {
                        kuwoSongs = kwData.data.list.map(function(item) {
                            return { id: item.rid, name: item.name, artistsname: item.artist, album: '', picurl: ensureHttpsUrl(item.pic || ''), duration: 0, platform: 'kuwo', kuwo_rid: item.rid };
                        });
                    }
                }
            } catch(e) { console.log('酷我搜索失败:', e); }
            try {
                var neResp = await fetch('https://node.api.xfabe.com/api/wangyi/search?search=' + encodeURIComponent(query) + '&limit=30');
                if (neResp.ok) {
                    var neData = await neResp.json();
                    if (neData.code === 200 && neData.data && neData.data.songs) {
                        neteaseSongs = neData.data.songs.map(function(song) {
                            return { id: song.id, name: song.name, artistsname: song.artistsname, album: song.album || '', picurl: ensureHttpsUrl(song.picurl || ''), duration: song.duration || 0, platform: 'netease' };
                        });
                        await Promise.all(neteaseSongs.map(async function(song, idx) {
                            try { var cover = await getHighQualityCover(song.id); if (cover) neteaseSongs[idx].picurl = ensureHttpsUrl(cover); } catch(e) {}
                        }));
                    }
                }
            } catch(e) { console.log('网易搜索失败:', e); }
            allSongs = kuwoSongs.concat(neteaseSongs);
            if (allSongs.length === 0) throw new Error('未找到相关歌曲');
            currentSongs = allSongs;
            displayResults(allSongs, resultsList, 'search');
            if (kuwoSongs.length > 0 && neteaseSongs.length > 0) {
                var children = resultsList.children;
                if (children.length > kuwoSongs.length) {
                    var separator = document.createElement('div');
                    separator.className = 'platform-separator';
                    separator.innerHTML = '<span>酷我/酷狗 ▲</span><span>▼ 网易云</span>';
                    children[kuwoSongs.length].before(separator);
                }
            }
            hideError();
            showToast('找到' + allSongs.length + '首相关歌曲（酷我' + kuwoSongs.length + '首 + 网易' + neteaseSongs.length + '首）', 'success');
            searchInProgress = false;
            return;
        } else if (currentPlatform === 'netease') {
            var response = await fetch('https://node.api.xfabe.com/api/wangyi/search?search=' + encodeURIComponent(query) + '&limit=30');
            if (!response.ok) throw new Error('搜索失败');
            var data = await response.json();
            if (data.code !== 200 || !data.data || !data.data.songs) throw new Error('未找到相关歌曲');
            var songs = data.data.songs;
            await Promise.all(songs.map(async function(song, idx) {
                song.picurl = ensureHttpsUrl(song.picurl || '');
                try { var cover = await getHighQualityCover(song.id); if (cover) songs[idx].picurl = ensureHttpsUrl(cover); } catch(e) {}
                songs[idx].platform = 'netease';
            }));
            if (!songs || songs.length === 0) throw new Error('未找到相关歌曲');
            currentSongs = songs;
        } else {
            var response = await secureFetch('http://kuwo.bfmzdx.cn/kuwo/search/searchMusicBykeyWord?key=' + encodeURIComponent(query));
            if (!response.ok) throw new Error('酷我搜索失败');
            var data = await response.json();
            if (!data.data || !data.data.list || data.data.list.length === 0) throw new Error('未找到相关歌曲');
            currentSongs = data.data.list.map(function(item) { return { id: item.rid, name: item.name, artistsname: item.artist, album: '', picurl: ensureHttpsUrl(item.pic || ''), duration: 0, platform: 'kuwo', kuwo_rid: item.rid }; });
        }
        displayResults(currentSongs, resultsList, 'search');
        hideError();
        showToast('找到' + currentSongs.length + '首相关歌曲', 'success');
    } catch (error) {
        if (currentPlatform === 'netease') {
            if (settings.autoSwitchOnNeteaseError) {
                currentPlatform = 'kuwo';
                updatePlatformButtons();
                showToast('网易云音乐不可用，已自动切换为酷我/酷狗搜索...', 'warning', 600);
                searchInProgress = false;
                await performSearchInternal(query);
                return;
            } else {
                showNeteaseErrorDialog(query);
            }
        } else {
            showToast('搜索失败，请重试！', 'error');
            showError(error.message);
            displayEmptyResults(resultsList, '服务器不稳定', '请多试几次');
        }
    } finally {
        searchInProgress = false;
    }
}

function showNeteaseErrorDialog(query) {
    var overlay = document.createElement('div');
    overlay.className = 'netease-error-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease;';

    var dialog = document.createElement('div');
    dialog.style.cssText = 'background:rgba(23,23,23,0.95);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:28px;max-width:400px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.5);animation:fadeUp 0.3s cubic-bezier(0.4,0,0.2,1);';

    dialog.innerHTML = '<div style="font-size:48px;margin-bottom:16px;">⚠️</div>' +
        '<h3 style="margin:0 0 12px;font-size:18px;color:#fff;">网易云音乐暂不可用</h3>' +
        '<p style="margin:0 0 24px;font-size:14px;color:rgba(255,255,255,0.7);line-height:1.6;">网易云音乐服务器不稳定，是否切换为酷我/酷狗搜索？</p>' +
        '<div style="display:flex;gap:12px;justify-content:center;">' +
        '<button class="netease-error-cancel" style="padding:10px 24px;border:1px solid rgba(255,255,255,0.15);border-radius:12px;background:transparent;color:rgba(255,255,255,0.7);font-size:14px;cursor:pointer;transition:all 0.2s;font-family:inherit;">取消</button>' +
        '<button class="netease-error-confirm" style="padding:10px 24px;border:none;border-radius:12px;background:linear-gradient(135deg, #7c3aed, #a855f7);color:#fff;font-size:14px;font-weight:600;cursor:pointer;transition:all 0.2s;font-family:inherit;">切换为酷我/酷狗</button>' +
        '</div>';

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    function close() {
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.2s ease';
        setTimeout(function() { overlay.remove(); }, 200);
    }

    dialog.querySelector('.netease-error-cancel').addEventListener('click', function() {
        close();
        showToast('已取消切换', 'info', 600);
        displayEmptyResults(resultsList, '服务器不稳定', '请多试几次');
    });

    dialog.querySelector('.netease-error-confirm').addEventListener('click', function() {
        close();
        currentPlatform = 'kuwo';
        updatePlatformButtons();
        showToast('已切换为酷我/酷狗，正在重新搜索...', 'info', 600);
        performSearchInternal(query);
    });

    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            close();
            showToast('已取消切换', 'info', 600);
            displayEmptyResults(resultsList, '服务器不稳定', '请多试几次');
        }
    });

    dialog.querySelector('.netease-error-cancel').addEventListener('mouseenter', function() {
        this.style.background = 'rgba(255,255,255,0.08)';
    });
    dialog.querySelector('.netease-error-cancel').addEventListener('mouseleave', function() {
        this.style.background = 'transparent';
    });
    dialog.querySelector('.netease-error-confirm').addEventListener('mouseenter', function() {
        this.style.background = 'linear-gradient(135deg, #6d28d9, #9333ea)';
    });
    dialog.querySelector('.netease-error-confirm').addEventListener('mouseleave', function() {
        this.style.background = 'linear-gradient(135deg, #7c3aed, #a855f7)';
    });
}

// ============================================
// 获取高清封面
// ============================================
async function getHighQualityCover(songId) {
    try {
        var resp = await fetch('https://api.lvxiaodong.com/api/wyyjx?url=https://music.163.com/song?id=' + songId);
        if (!resp.ok) throw new Error('主API请求失败');
        var data = await resp.json();
        if (data.code === 200 && data.data && data.data.cover) return ensureHttpsUrl(data.data.cover);
        throw new Error('主API未返回封面');
    } catch(e) {
        try {
            var resp2 = await fetch('https://node.api.xfabe.com/api/wangyi/music?type=json&id=' + songId);
            if (!resp2.ok) throw new Error('备用API请求失败');
            var data2 = await resp2.json();
            if (data2.code === 200 && data2.data && data2.data.picurl) return ensureHttpsUrl(data2.data.picurl);
            throw new Error('备用API未返回封面');
        } catch(e2) { return null; }
    }
}

// ============================================
// 播放歌曲（简写）
// ============================================
async function playSong(song, index) {
    await playSongWithOptions(song, index, {});
}

// ============================================
// 更新封面
// ============================================
function updateAlbumCover(song) {
    var nowCover = nowPlayingCover;
    nowCover.style.background = 'none';
    nowCover.innerHTML = ''
    if (song.picurl) {
        var img = document.createElement('img');
        img.src = song.picurl;
        img.crossOrigin = 'Anonymous';
        img.onload = function() {
            nowCover.innerHTML = ''
            nowCover.appendChild(img);
            nowCover.classList.add('has-image');
            if (settings.coverRotation) {
                nowCover.classList.add('cover-rotation');
            } else {
                nowCover.classList.remove('cover-rotation');
            }
        };
        img.onerror = function() {
            nowCover.innerHTML = '<i class="fas fa-music"></i>';
            nowCover.classList.remove('has-image', 'cover-rotation');
        };
        nowCover.appendChild(img);
    } else {
        nowCover.innerHTML = '<i class="fas fa-music"></i>';
        nowCover.classList.remove('has-image', 'cover-rotation');
    }
    var fullCover = fullscreenCover;
    var hadImage = fullCover.classList.contains('has-image');

    function swapFullCoverDirect() {
        fullCover.style.background = 'none';
        fullCover.innerHTML = '';
        fullCover.style.transform = '';
        fullCover.style.opacity = '';
        fullCover.style.filter = '';
        fullCover.style.clipPath = '';
        fullCover.style.transition = '';
        if (song.picurl) {
            var img2 = document.createElement('img');
            img2.src = song.picurl;
            img2.crossOrigin = 'Anonymous';
            img2.onload = function() {
                fullCover.innerHTML = '';
                fullCover.appendChild(img2);
                fullCover.classList.add('has-image');
                if (settings.coverRotation) {
                    fullCover.classList.add('cover-rotation');
                } else {
                    fullCover.classList.remove('cover-rotation');
                }
                fullCover.style.opacity = '1';
                extractDominantColor(img2, function(color) { fullscreenProgress.style.background = color; });
            };
            img2.onerror = function() {
                fullCover.innerHTML = '<i class="fas fa-music"></i>';
                fullCover.classList.remove('has-image', 'cover-rotation');
                fullCover.style.opacity = '1';
            };
            fullCover.appendChild(img2);
            fullCover.style.opacity = '1';
        } else {
            fullCover.innerHTML = '<i class="fas fa-music"></i>';
            fullCover.classList.remove('has-image', 'cover-rotation');
            fullCover.style.opacity = '1';
        }
    }

    function preloadCoverImg(url, callback) {
        var img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = function() { callback(img); };
        img.onerror = function() { callback(null); };
        img.src = url;
    }

    if (hadImage && song.picurl) {
        var transitionType = settings.coverTransition || 'flip3d';
        var isPrev = coverTransitionDirection === 'prev';
        coverTransitionDirection = 'none';

        switch (transitionType) {
            case 'none':
                swapFullCoverDirect();
                break;
            case 'fade':
                coverTransitionFade(song, fullCover, preloadCoverImg, swapFullCoverDirect);
                break;
            case 'slideH':
                coverTransitionSlideH(song, fullCover, preloadCoverImg, swapFullCoverDirect, isPrev);
                break;
            case 'slideV':
                coverTransitionSlideV(song, fullCover, preloadCoverImg, swapFullCoverDirect);
                break;
            case 'flip3d':
                coverTransitionFlip3D(song, fullCover, preloadCoverImg, swapFullCoverDirect, isPrev);
                break;
            case 'scaleBounce':
                coverTransitionScaleBounce(song, fullCover, preloadCoverImg, swapFullCoverDirect);
                break;
            case 'blur':
                coverTransitionBlur(song, fullCover, preloadCoverImg, swapFullCoverDirect);
                break;
            case 'circleReveal':
                coverTransitionCircleReveal(song, fullCover, preloadCoverImg, swapFullCoverDirect);
                break;
            case 'blinds':
                coverTransitionBlinds(song, fullCover, preloadCoverImg, swapFullCoverDirect);
                break;
            case 'rotateScale':
                coverTransitionRotateScale(song, fullCover, preloadCoverImg, swapFullCoverDirect);
                break;
            case 'skewSlide':
                coverTransitionSkewSlide(song, fullCover, preloadCoverImg, swapFullCoverDirect, isPrev);
                break;
            default:
                coverTransitionFlip3D(song, fullCover, preloadCoverImg, swapFullCoverDirect, isPrev);
        }
    } else {
        swapFullCoverDirect();
    }
}

// ============================================
// 封面切换动画
// ============================================

function applyCoverImage(cover, img, swapFn) {
    cover.style.background = 'none';
    cover.innerHTML = '';
    cover.appendChild(img);
    cover.classList.add('has-image');
    if (settings.coverRotation) {
        cover.classList.add('cover-rotation');
    } else {
        cover.classList.remove('cover-rotation');
    }
    extractDominantColor(img, function(color) { fullscreenProgress.style.background = color; });
}

function coverErrorFallback(cover) {
    cover.innerHTML = '<i class="fas fa-music"></i>';
    cover.classList.remove('has-image', 'cover-rotation');
}

function cleanupCoverAnimation(cover) {
    cover.style.transform = '';
    cover.style.opacity = '';
    cover.style.filter = '';
    cover.style.clipPath = '';
    cover.style.transition = '';
}

// 1. 淡入淡出
function coverTransitionFade(song, cover, preloadFn, swapFn) {
    var savedTransition = cover.style.transition;
    cover.style.transition = 'opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1)';
    cover.style.opacity = '0';
    preloadFn(song.picurl, function(img) {
        if (!img) { coverErrorFallback(cover); cleanupCoverAnimation(cover); cover.style.transition = savedTransition; return; }
        cover.style.transition = 'opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1)';
        cover.style.opacity = '0';
        void cover.offsetHeight;
        applyCoverImage(cover, img, swapFn);
        cover.style.opacity = '1';
        cover.addEventListener('transitionend', function handler() {
            cover.removeEventListener('transitionend', handler);
            cleanupCoverAnimation(cover);
            cover.style.transition = savedTransition;
        });
    });
}

// 2. 水平滑动
function coverTransitionSlideH(song, cover, preloadFn, swapFn, isPrev) {
    var dir = isPrev ? '100%' : '-100%';
    var savedTransition = cover.style.transition;
    cover.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease';
    cover.style.transform = 'translateX(' + (isPrev ? '-100%' : '100%') + ')';
    cover.style.opacity = '0.5';
    preloadFn(song.picurl, function(img) {
        if (!img) { coverErrorFallback(cover); cleanupCoverAnimation(cover); cover.style.transition = savedTransition; return; }
        applyCoverImage(cover, img, swapFn);
        cover.style.transition = 'none';
        cover.style.transform = 'translateX(' + (isPrev ? '100%' : '-100%') + ')';
        cover.style.opacity = '0.5';
        void cover.offsetHeight;
        cover.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease';
        cover.style.transform = 'translateX(0)';
        cover.style.opacity = '1';
        cover.addEventListener('transitionend', function handler() {
            cover.removeEventListener('transitionend', handler);
            cleanupCoverAnimation(cover);
            cover.style.transition = savedTransition;
        });
    });
}

// 3. 垂直滑动
function coverTransitionSlideV(song, cover, preloadFn, swapFn) {
    var savedTransition = cover.style.transition;
    cover.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease';
    cover.style.transform = 'translateY(-100%)';
    cover.style.opacity = '0.3';
    preloadFn(song.picurl, function(img) {
        if (!img) { coverErrorFallback(cover); cleanupCoverAnimation(cover); cover.style.transition = savedTransition; return; }
        applyCoverImage(cover, img, swapFn);
        cover.style.transition = 'none';
        cover.style.transform = 'translateY(100%)';
        cover.style.opacity = '0.3';
        void cover.offsetHeight;
        cover.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease';
        cover.style.transform = 'translateY(0)';
        cover.style.opacity = '1';
        cover.addEventListener('transitionend', function handler() {
            cover.removeEventListener('transitionend', handler);
            cleanupCoverAnimation(cover);
            cover.style.transition = savedTransition;
        });
    });
}

// 4. 3D 翻转
function coverTransitionFlip3D(song, cover, preloadFn, swapFn, isPrev) {
    var savedTransition = cover.style.transition;
    cover.style.transition = 'none';

    var flipOutKf = isPrev ? [
        { transform: 'perspective(800px) rotateY(0deg)', opacity: 1, filter: 'blur(0)' },
        { transform: 'perspective(800px) rotateY(90deg)', opacity: 0.3, filter: 'blur(4px)' }
    ] : [
        { transform: 'perspective(800px) rotateY(0deg)', opacity: 1, filter: 'blur(0)' },
        { transform: 'perspective(800px) rotateY(-90deg)', opacity: 0.3, filter: 'blur(4px)' }
    ];

    var flipInKf = isPrev ? [
        { transform: 'perspective(800px) rotateY(-90deg)', opacity: 0.3, filter: 'blur(4px)' },
        { transform: 'perspective(800px) rotateY(0deg)', opacity: 1, filter: 'blur(0)' }
    ] : [
        { transform: 'perspective(800px) rotateY(90deg)', opacity: 0.3, filter: 'blur(4px)' },
        { transform: 'perspective(800px) rotateY(0deg)', opacity: 1, filter: 'blur(0)' }
    ];

    var flipOut = cover.animate(flipOutKf, { duration: 450, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' });

    var flipped = false;
    var loaded = false;

    function doFlipIn() {
        if (!flipped || !loaded) return;
        applyCoverImage(cover, preloadImg, swapFn);
        var flipIn = cover.animate(flipInKf, { duration: 450, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' });
        flipIn.onfinish = function() {
            flipIn.cancel();
            cleanupCoverAnimation(cover);
            cover.style.transition = savedTransition;
        };
    }

    var preloadImg = new Image();
    preloadImg.crossOrigin = 'Anonymous';
    preloadImg.onload = function() { loaded = true; doFlipIn(); };
    preloadImg.onerror = function() {
        flipOut.cancel();
        coverErrorFallback(cover);
        cleanupCoverAnimation(cover);
        cover.style.transition = savedTransition;
    };
    preloadImg.src = song.picurl;

    flipOut.onfinish = function() { flipOut.cancel(); flipped = true; doFlipIn(); };
}

// 5. 缩放弹入
function coverTransitionScaleBounce(song, cover, preloadFn, swapFn) {
    var savedTransition = cover.style.transition;
    cover.style.transition = 'transform 0.3s cubic-bezier(0.6, 0, 1, 1), opacity 0.25s ease';
    cover.style.transform = 'scale(0.3)';
    cover.style.opacity = '0';
    preloadFn(song.picurl, function(img) {
        if (!img) { coverErrorFallback(cover); cleanupCoverAnimation(cover); cover.style.transition = savedTransition; return; }
        applyCoverImage(cover, img, swapFn);
        cover.style.transition = 'none';
        cover.style.transform = 'scale(0.3)';
        cover.style.opacity = '0';
        void cover.offsetHeight;
        cover.style.transition = 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease';
        cover.style.transform = 'scale(1)';
        cover.style.opacity = '1';
        cover.addEventListener('transitionend', function handler() {
            cover.removeEventListener('transitionend', handler);
            cleanupCoverAnimation(cover);
            cover.style.transition = savedTransition;
        });
    });
}

// 6. 模糊过渡
function coverTransitionBlur(song, cover, preloadFn, swapFn) {
    var savedTransition = cover.style.transition;
    cover.style.transition = 'filter 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease';
    cover.style.filter = 'blur(20px)';
    cover.style.opacity = '0';
    preloadFn(song.picurl, function(img) {
        if (!img) { coverErrorFallback(cover); cleanupCoverAnimation(cover); cover.style.transition = savedTransition; return; }
        applyCoverImage(cover, img, swapFn);
        cover.style.transition = 'none';
        cover.style.filter = 'blur(20px)';
        cover.style.opacity = '0';
        void cover.offsetHeight;
        cover.style.transition = 'filter 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease';
        cover.style.filter = 'blur(0)';
        cover.style.opacity = '1';
        cover.addEventListener('transitionend', function handler() {
            cover.removeEventListener('transitionend', handler);
            cleanupCoverAnimation(cover);
            cover.style.transition = savedTransition;
        });
    });
}

// 7. 圆形扩散
function coverTransitionCircleReveal(song, cover, preloadFn, swapFn) {
    var savedTransition = cover.style.transition;
    cover.style.transition = 'none';
    cover.style.clipPath = 'circle(0% at 50% 50%)';
    preloadFn(song.picurl, function(img) {
        if (!img) { coverErrorFallback(cover); cleanupCoverAnimation(cover); cover.style.transition = savedTransition; return; }
        applyCoverImage(cover, img, swapFn);
        cover.style.transition = 'none';
        cover.style.clipPath = 'circle(0% at 50% 50%)';
        void cover.offsetHeight;
        cover.style.transition = 'clip-path 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
        cover.style.clipPath = 'circle(100% at 50% 50%)';
        cover.addEventListener('transitionend', function handler() {
            cover.removeEventListener('transitionend', handler);
            cleanupCoverAnimation(cover);
            cover.style.transition = savedTransition;
        });
    });
}

// 8. 百叶窗
function coverTransitionBlinds(song, cover, preloadFn, swapFn) {
    var savedTransition = cover.style.transition;
    cover.style.transition = 'none';
    cover.style.clipPath = 'inset(0 0 100% 0)';
    preloadFn(song.picurl, function(img) {
        if (!img) { coverErrorFallback(cover); cleanupCoverAnimation(cover); cover.style.transition = savedTransition; return; }
        applyCoverImage(cover, img, swapFn);
        cover.style.transition = 'none';
        cover.style.clipPath = 'inset(0 0 100% 0)';
        void cover.offsetHeight;
        cover.style.transition = 'clip-path 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
        cover.style.clipPath = 'inset(0 0 0% 0)';
        cover.addEventListener('transitionend', function handler() {
            cover.removeEventListener('transitionend', handler);
            cleanupCoverAnimation(cover);
            cover.style.transition = savedTransition;
        });
    });
}

// 9. 旋转缩放
function coverTransitionRotateScale(song, cover, preloadFn, swapFn) {
    var savedTransition = cover.style.transition;
    cover.style.transition = 'transform 0.4s cubic-bezier(0.6, 0, 1, 1), opacity 0.3s ease';
    cover.style.transform = 'rotate(30deg) scale(0.3)';
    cover.style.opacity = '0';
    preloadFn(song.picurl, function(img) {
        if (!img) { coverErrorFallback(cover); cleanupCoverAnimation(cover); cover.style.transition = savedTransition; return; }
        applyCoverImage(cover, img, swapFn);
        cover.style.transition = 'none';
        cover.style.transform = 'rotate(-30deg) scale(0.3)';
        cover.style.opacity = '0';
        void cover.offsetHeight;
        cover.style.transition = 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease';
        cover.style.transform = 'rotate(0deg) scale(1)';
        cover.style.opacity = '1';
        cover.addEventListener('transitionend', function handler() {
            cover.removeEventListener('transitionend', handler);
            cleanupCoverAnimation(cover);
            cover.style.transition = savedTransition;
        });
    });
}

// 10. 斜切滑入
function coverTransitionSkewSlide(song, cover, preloadFn, swapFn, isPrev) {
    var savedTransition = cover.style.transition;
    cover.style.transition = 'transform 0.35s cubic-bezier(0.6, 0, 1, 1), opacity 0.25s ease';
    cover.style.transform = 'skewX(' + (isPrev ? '20deg' : '-20deg') + ') translateX(' + (isPrev ? '100%' : '-100%') + ')';
    cover.style.opacity = '0';
    preloadFn(song.picurl, function(img) {
        if (!img) { coverErrorFallback(cover); cleanupCoverAnimation(cover); cover.style.transition = savedTransition; return; }
        applyCoverImage(cover, img, swapFn);
        cover.style.transition = 'none';
        cover.style.transform = 'skewX(' + (isPrev ? '-20deg' : '20deg') + ') translateX(' + (isPrev ? '-100%' : '100%') + ')';
        cover.style.opacity = '0';
        void cover.offsetHeight;
        cover.style.transition = 'transform 0.45s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.35s ease';
        cover.style.transform = 'skewX(0) translateX(0)';
        cover.style.opacity = '1';
        cover.addEventListener('transitionend', function handler() {
            cover.removeEventListener('transitionend', handler);
            cleanupCoverAnimation(cover);
            cover.style.transition = savedTransition;
        });
    });
}

// ============================================
// 获取音频 URL
// ============================================

function resetCoverAnimation(cover) {
    cover.style.animation = 'none';
    void cover.offsetHeight;
    cover.style.animation = '';
}

async function getAudioUrl(songId, quality, platform) {
    platform = platform || currentPlatform;
    if (platform === 'all') platform = 'netease';
    try {
        if (platform === 'netease') {
            try {
                var resp = await fetch('https://api.byfuns.top/1/?id=' + songId + '&level=' + quality);
                if (!resp.ok) throw new Error('主音频API请求失败');
                var url = await resp.text();
                if (url && url.startsWith('http')) return url;
                throw new Error('主API返回无效链接');
            } catch(e) {
                var resp2 = await fetch('https://node.api.xfabe.com/api/wangyi/music?type=json&id=' + songId);
                if (!resp2.ok) throw new Error('备用音频API请求失败');
                var data = await resp2.json();
                if (data.code === 200 && data.data && data.data.url) return data.data.url;
                throw new Error('所有音频源均失败');
            }
        } else {
            var rid = songId;
            var resp = await secureFetch('http://kuwo.bfmzdx.cn/kuwo/url?mid=' + rid + '&type=music&br=192kflac');
            var data = await resp.json();
            if (data.data && data.data.url) return data.data.url;
            if (data.url) return data.url;
            if (typeof data.data === 'string' && data.data.startsWith('http')) return data.data;
            if (data.data && typeof data.data === 'object') {
                var val = Object.values(data.data).find(function(v) { return typeof v === 'string' && v.startsWith('http'); });
                if (val) return val;
            }
            throw new Error('无法获取酷我音频链接');
        }
    } catch (error) { throw error; }
}

// ============================================
// 下载歌曲
// ============================================
async function downloadSong(song) {
    if (!isLoggedIn) { showToast('请先登录后再下载歌曲', 'warning'); loginModal.classList.add('active'); return; }
    try {
        showToast('正在准备下载，请稍候...', 'info');
        var audioUrl;
        if (song.platform === 'kuwo') {
            var rid = song.kuwo_rid || song.id;
            var resp = await secureFetch('http://kuwo.bfmzdx.cn/kuwo/url?mid=' + rid + '&type=music&br=192kflac');
            var data = await resp.json();
            audioUrl = data.data?.url;
        } else audioUrl = await getAudioUrl(song.id, currentQuality, song.platform);
        if (!audioUrl) throw new Error('获取链接失败');

        var ext = 'flac';
        if (song.platform === 'netease' && (currentQuality === 'hires' || currentQuality === 'lossless')) ext = 'flac';
        var filename = song.name + ' - ' + song.artistsname + '.' + ext;

        var blob = await downloadBlob(audioUrl);
        if (!blob || blob.size === 0) {
            try {
                var a2 = document.createElement('a');
                a2.href = audioUrl;
                a2.download = filename;
                a2.target = '_blank';
                a2.rel = 'noopener';
                a2.style.display = 'none';
                document.body.appendChild(a2);
                a2.click();
                setTimeout(function() { document.body.removeChild(a2); }, 1000);
                showToast('已在新标签页打开（请手动下载 ）', 'info');
                return;
            } catch (e) {}
            throw new Error('无法获取音频数据');
        }

        if ('showSaveFilePicker' in window) {
            try {
                var handle = await window.showSaveFilePicker({
                    suggestedName: filename,
                    types: [{ description: 'Audio File', accept: { 'audio/*': ['.' + ext] } }]
                });
                var writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
                showToast('下载完成 (' + (song.platform === 'netease' ? qualityNames[currentQuality] : '至臻母带音质') + ')', 'success');
                return;
            } catch (pickerError) {
                if (pickerError.name === 'AbortError') return;
            }
        }
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
        showToast('下载已开始 (' + (song.platform === 'netease' ? qualityNames[currentQuality] : '至臻母带音质') + ')', 'success');
    } catch (error) {
        showToast('下载失败，请稍后重试', 'error');
    }
}

async function downloadBlob(audioUrl) {
    try {
        var proxyUrl = '/api/download-proxy?url=' + encodeURIComponent(audioUrl);
        var resp = await fetch(proxyUrl);
        if (resp.ok) return await resp.blob();
    } catch (e) {}
    try {
        var resp2 = await fetch(audioUrl, { mode: 'cors' });
        if (resp2.ok) return await resp2.blob();
    } catch (e) {}
    try {
        var resp3 = await fetch(audioUrl);
        if (resp3.ok) return await resp3.blob();
    } catch (e) {}
    try {
        var extProxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(audioUrl);
        var resp4 = await fetch(extProxyUrl);
        if (resp4.ok) return await resp4.blob();
    } catch (e) {}
    return null;
}

// ============================================
// 播放控制
// ============================================
function togglePlayPause() {
    if (!audioPlayer.src) return;
    if (isPlaying) {
        audioPlayer.pause();
        playIcon.className = 'fas fa-play';
        fullscreenPlayIcon.className = 'fas fa-play';
        nowPlayingCover.classList.remove('playing');
        fullscreenCover.classList.remove('playing');
    } else {
        audioPlayer.play();
        playIcon.className = 'fas fa-pause';
        fullscreenPlayIcon.className = 'fas fa-pause';
        if (settings.coverRotation) { nowPlayingCover.classList.add('playing'); fullscreenCover.classList.add('playing'); }
    }
    isPlaying = !isPlaying;
    if (settings.vibration && navigator.vibrate) navigator.vibrate(30);
    updateMediaSessionPlaybackState();
}

function playPrev() {
    coverTransitionDirection = 'prev';
    var songs = currentSongs;
    if (currentPage === 'favorites') songs = favorites;
    else if (currentPage === 'history') songs = playHistory.map(function(record) { return record.song; });
    if (songs.length === 0) return;
    var newIndex = currentIndex - 1;
    if (newIndex < 0) newIndex = songs.length - 1;
    playSong(songs[newIndex], newIndex);
}
function playNext() {
    coverTransitionDirection = 'next';
    var songs = currentSongs;
    if (currentPage === 'favorites') songs = favorites;
    else if (currentPage === 'history') songs = playHistory.map(function(record) { return record.song; });
    if (songs.length === 0) return;
    var newIndex = currentIndex + 1;
    if (newIndex >= songs.length) newIndex = 0;
    playSong(songs[newIndex], newIndex);
}

function handleSongEnd() {
    coverTransitionDirection = 'next';
    var playlist = [];
    if (currentPage === 'favorites') playlist = favorites;
    else if (currentPage === 'history') playlist = playHistory.map(function(record) { return record.song; });
    else playlist = currentSongs;
    if (playlist.length === 0) { resetPageTitle(); return; }
    if (settings.playMode === 'single') {
        if (currentIndex !== -1) playSong(playlist[currentIndex], currentIndex);
    } else if (settings.playMode === 'random') {
        var randomIndex; do { randomIndex = Math.floor(Math.random() * playlist.length); } while (playlist.length > 1 && randomIndex === currentIndex);
        if (settings.crossfade) crossfadeSwitch(playlist[randomIndex], randomIndex);
        else playSong(playlist[randomIndex], randomIndex);
    } else {
        var newIndex = currentIndex + 1;
        if (newIndex >= playlist.length) newIndex = 0;
        if (settings.crossfade) crossfadeSwitch(playlist[newIndex], newIndex);
        else playSong(playlist[newIndex], newIndex);
    }
    if (settings.vibration && navigator.vibrate) navigator.vibrate([100,50,100]);
    updateMediaSessionPlaybackState();
}

function handleAudioError() {
    console.error('音频错误:', audioPlayer.error);
    showToast('播放失败，请尝试其他音质或歌曲', 'error');
    isPlaying = false;
    playIcon.className = 'fas fa-play';
    fullscreenPlayIcon.className = 'fas fa-play';
    nowPlayingCover.classList.remove('playing');
    fullscreenCover.classList.remove('playing');
    updateMediaSessionPlaybackState();
    resetPageTitle();
}

// ============================================
// 进度条
// ============================================
function updateProgress() {
    if (!audioPlayer.duration) return;
    var percent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    progress.style.width = percent + '%';
    fullscreenProgress.style.width = percent + '%';
    var current = formatTime(audioPlayer.currentTime);
    var remaining = audioPlayer.duration - audioPlayer.currentTime;
    var remainingStr = '-' + formatTime(remaining);
    currentTimeEl.textContent = current;
    fullscreenCurrentTime.textContent = current;
    durationEl.textContent = remainingStr;
    fullscreenDuration.textContent = remainingStr;
    updateLyrics(audioPlayer.currentTime);
    if (Math.floor(audioPlayer.currentTime * 2) % 2 === 0) updateMediaSessionPlaybackState();
    if (settings.crossfade && !crossfadeTriggered && remaining <= 3.5 && remaining > 0 && currentSongs.length > 0) {
        crossfadeTriggered = true;
        coverTransitionDirection = 'next';
        var playlist = [];
        if (currentPage === 'favorites') playlist = favorites;
        else if (currentPage === 'history') playlist = playHistory.map(function(record) { return record.song; });
        else playlist = currentSongs;
        if (playlist.length === 0) return;
        var next;
        if (settings.playMode === 'single') {
            next = { song: playlist[currentIndex], index: currentIndex };
        } else if (settings.playMode === 'random') {
            var randomIndex; do { randomIndex = Math.floor(Math.random() * playlist.length); } while (playlist.length > 1 && randomIndex === currentIndex);
            next = { song: playlist[randomIndex], index: randomIndex };
        } else {
            var newIndex = currentIndex + 1;
            if (newIndex >= playlist.length) newIndex = 0;
            next = { song: playlist[newIndex], index: newIndex };
        }
        if (next) crossfadeSwitch(next.song, next.index);
    }
}
function updateDuration() {
    var remaining = audioPlayer.duration - audioPlayer.currentTime;
    durationEl.textContent = '-' + formatTime(remaining);
    fullscreenDuration.textContent = '-' + formatTime(remaining);
}
function formatTime(seconds) {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    var mins = Math.floor(seconds / 60);
    var secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    return mins + ':' + secs;
}
function formatKuwoTime(seconds) {
    var mins = Math.floor(seconds / 60);
    var secs = Math.floor(seconds % 60);
    var ms = Math.floor((seconds % 1) * 100);
    return mins.toString().padStart(2,'0') + ':' + secs.toString().padStart(2,'0') + '.' + ms.toString().padStart(2,'0');
}

// ============================================
// 歌词 - 使用新API (支持逐字歌词和翻译)
// ============================================
async function loadLyrics(songId, platform) {
    platform = platform || currentPlatform;
    if (platform === 'all') platform = 'netease';
    if (!settings.showLyrics) return;
    lyricsLoading = true;
    lyricsData = [];
    lastLyricIndex = -1;
    if (floatingLyrics) { floatingLyrics.classList.remove('visible'); floatingLyrics.style.opacity = '0'; }
    lyricsContainer.innerHTML = '<div class="lyrics-loading" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:rgba(255,255,255,0.7);"><div class="win-spinner win-spinner-sm"><div class="win-spinner-wrapper"><div class="win-spinner-item"><div class="win-spinner-ball"></div></div><div class="win-spinner-item"><div class="win-spinner-ball"></div></div><div class="win-spinner-item"><div class="win-spinner-ball"></div></div><div class="win-spinner-item"><div class="win-spinner-ball"></div></div><div class="win-spinner-item"><div class="win-spinner-ball"></div></div></div></div><p style="margin-top:16px;">正在载入歌词...</p></div>';
    try {
        if (platform === 'netease') {
            var resp = await fetch('https://api.vkeys.cn/v2/music/netease/lyric?id=' + songId);
            if (!resp.ok) throw new Error('获取歌词失败');
            var data = await resp.json();
            if (data.code !== 200 || !data.data) throw new Error('未找到歌词');
            
            var lrcText = data.data.lrc || ''
            var transText = data.data.trans || ''
            var yrcText = data.data.yrc || ''
            
            if (lrcText && lrcText.trim()) {
                processLrcTextWithTranslation(lrcText, transText, yrcText);
            } else {
                throw new Error('歌词文本为空');
            }
        } else {
            // 酷我歌词保持原有逻辑
            var resp = await secureFetch('http://kuwo.bfmzdx.cn/kuwo/lrc?musicId=' + songId);
            if (!resp.ok) throw new Error('获取酷我歌词失败');
            var data = await resp.json();
            var lrcText = ''
            if (data.data && data.data.lrclist && Array.isArray(data.data.lrclist)) {
                lrcText = data.data.lrclist.filter(function(item) { return item.lineLyric && item.lineLyric.trim(); }).map(function(item) { return '[' + formatKuwoTime(item.time) + ']' + item.lineLyric; }).join('\n');
            } else if (data.data && data.data.lyric) lrcText = data.data.lyric;
            else if (data.data && typeof data.data === 'string') lrcText = data.data;
            else if (data.lyric) lrcText = data.lyric;
            else if (data.data && data.data.lrc) lrcText = data.data.lrc;
            else {
                var find = function(obj) {
                    if (typeof obj === 'string' && obj.includes('[') && obj.includes(']')) return obj;
                    if (Array.isArray(obj) && obj.length > 0 && obj[0].time !== undefined && obj[0].lineLyric !== undefined) {
                        return obj.map(function(item) { return '[' + formatKuwoTime(item.time) + ']' + item.lineLyric; }).join('\n');
                    }
                    if (obj && typeof obj === 'object') {
                        for (var key in obj) { var res = find(obj[key]); if (res) return res; }
                    }
                    return null;
                };
                lrcText = find(data);
                if (!lrcText) throw new Error('未找到酷我歌词');
            }
            if (lrcText && lrcText.trim()) {
                var parsed = parseLrc(lrcText);
                lyricsData = parsed.lyrics;
                renderLyrics();
            } else {
                throw new Error('歌词文本为空');
            }
        }
    } catch (error) {
        console.error('歌词载入错误:', error);
        showNoLyrics();
    } finally { lyricsLoading = false; }
}

// ============================================
// 处理带翻译和逐字歌词的LRC文本
// ============================================
function processLrcTextWithTranslation(lrcText, transText, yrcText) {
    var parsed = parseLrc(lrcText);
    var transParsed = parseLrc(transText);
    
    var transMap = {};
    transParsed.lyrics.forEach(function(item) {
        var key = Math.round(item.time * 100);
        if (!transMap[key]) transMap[key] = [];
        transMap[key].push(item.text);
    });
    
    var yrcList = [];
    if (yrcText && yrcText.trim()) {
        var yrcLines = yrcText.trim().split('\n');
        yrcLines.forEach(function(line) {
            var match = line.match(/\[(\d+),(\d+)\](.*)/);
            if (match) {
                var startTime = parseInt(match[1], 10) / 1000;
                var duration = parseInt(match[2], 10) / 1000;
                var rest = match[3] || ''
                var charTimings = [];
                var charMatch;
                var charRegex = /\((\d+),(\d+),(\d+)\)/g;
                while ((charMatch = charRegex.exec(rest)) !== null) {
                    charTimings.push({
                        offset: parseInt(charMatch[1], 10) / 1000,
                        duration: parseInt(charMatch[2], 10) / 1000
                    });
                }
                var text = rest.replace(/\(\d+,\d+,\d+\)/g, '').trim();
                if (text && duration > 0) {
                    yrcList.push({
                        startTime: startTime,
                        duration: duration,
                        text: text,
                        charTimings: charTimings
                    });
                }
            }
        });
    }
    
    function findYrc(lrcTime) {
        for (var i = 0; i < yrcList.length; i++) {
            var diff = Math.abs(yrcList[i].startTime - lrcTime);
            if (diff < 0.05) return yrcList[i];
        }
        return null;
    }
    
    lyricsData = parsed.lyrics.map(function(item) {
        var key = Math.round(item.time * 100);
        var translation = transMap[key] ? transMap[key].join(' ') : null;
        var yrc = findYrc(item.time);
        
        if (translation && item.ele) {
            var transP = document.createElement('p');
            transP.className = 'lyric-translation';
            transP.textContent = translation;
            transP.style.fontSize = '16px';
            transP.style.color = 'rgba(255,255,255,0.3)';
            transP.style.fontWeight = '400';
            transP.style.marginTop = '6px';
            transP.style.transition = 'all 0.7s cubic-bezier(.19,.11,0,1)';
            transP.style.letterSpacing = '0.3px';
            transP.style.lineHeight = '1.4';
            var mainP = item.ele.querySelector('p');
            if (mainP) {
                mainP.after(transP);
            }
        }
        
        if (yrc && item.ele && yrc.charTimings.length > 0) {
            var mainP = item.ele.querySelector('p');
            if (mainP) {
                mainP.innerHTML = ''
                mainP.className = 'lyric-yrc-line';
                for (var ci = 0; ci < yrc.text.length; ci++) {
                    var span = document.createElement('span');
                    span.className = 'lyric-char';
                    span.textContent = yrc.text[ci];
                    var timing = (ci < yrc.charTimings.length) ? yrc.charTimings[ci] : yrc.charTimings[yrc.charTimings.length - 1];
                    span.dataset.charStart = (yrc.startTime + timing.offset).toString();
                    span.dataset.charDuration = timing.duration.toString();
                    span.style.display = 'inline-block';
                    span.style.transition = 'color 0.15s ease';
                    mainP.appendChild(span);
                }
                item.ele.dataset.yrcLine = 'true';
            }
        }
        
        return {
            time: item.time,
            text: item.text,
            translation: translation,
            yrc: yrc,
            ele: item.ele
        };
    });
    
    renderLyrics();
}

// ============================================
// parseLrc - 保持不变
// ============================================
function parseLrc(lrcText) {
    if (!lrcText || !lrcText.trim()) {
        return { lyrics: [] };
    }
    var lines = lrcText.trim().split('\n');
    var arr = [];
    lines.forEach(function(line) {
        var match = line.match(/\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/);
        if (match) {
            var minutes = parseInt(match[1], 10);
            var seconds = parseInt(match[2], 10);
            var ms = match[3] ? parseInt(match[3], 10) : 0;
            ms = match[3] && match[3].length === 2 ? ms / 100 : ms / 1000;
            var text = line.replace(match[0], '').trim();
            var time = minutes * 60 + seconds + ms;
            if (text) {
                var div = document.createElement('div');
                div.className = 'item';
                var p = document.createElement('p');
                p.textContent = text;
                div.appendChild(p);
                arr.push({ time: time, text: text, ele: div });
            }
        }
    });
    return { lyrics: arr };
}

// ============================================
// renderLyrics - 渲染歌词
// ============================================
function renderLyrics() {
    lyricsContainer.innerHTML = ''
    if (lyricsData.length === 0) { showNoLyrics(); return; }
    
    lyricsElement = document.createElement('div');
    lyricsElement.className = 'lyrics';
    lyricsContainer.appendChild(lyricsElement);
    
    for (var i = 0; i < lyricsData.length; i++) {
        lyricsElement.appendChild(lyricsData[i].ele);
    }
    
    UpdateLyricsLayout(0, lyricsData, 0);
    
    for (var i = 0; i < lyricsData.length; i++) {
        lyricsData[i].ele.style.transition = "all 0.7s cubic-bezier(.19,.11,0,1)";
    }
}

// ============================================
// GetLyricsLayout - 完全保持原有逻辑
// ============================================
function GetLyricsLayout(now, to, data) {
    var res = 0;
    if (to > now) {
        for (var i = now; i < to; i++) {
            res += data[i].ele.offsetHeight + LINE_HEIGHT;
        }
    } else {
        for (var i = now; i > to; i--) {
            res -= data[i - 1].ele.offsetHeight + LINE_HEIGHT;
        }
    }
    return res + LYRICS_OFFSET;
}

// ============================================
// UpdateLyricsLayout - 只控制位置和模糊，颜色由updateLyrics控制
// ============================================
function UpdateLyricsLayout(index, data, init) {
    init = init || 1;
    for (var i = 0; i < data.length; i++) {
        var ele = data[i].ele;
        if (!ele) continue;
        
        ele.style.filter = "blur(" + Math.abs(i - index) + "px)";
        var pos = GetLyricsLayout(index, i, data);
        var n = (i - index) + 1;
        if (n > 10) n = 0;
        setTimeout(function(idx, el, position) {
            return function() {
                el.style.transform = "translateY(" + position + "px)";
            };
        }(i, ele, pos), (n * 70 - n * 10) * init);
    }
}

// ============================================
// updateLyrics - 控制颜色和逐字填充
// ============================================
var cachedThemeColor = '';
var cachedThemeR = 255, cachedThemeG = 255, cachedThemeB = 255;
var cachedThemeR2 = 124, cachedThemeG2 = 58, cachedThemeB2 = 237;

function updateLyrics(currentTime) {
    if (lyricsData.length === 0 || lyricsLoading) return;
    
    var activeIndex = -1;
    for (var i = 0; i < lyricsData.length; i++) {
        if (currentTime >= lyricsData[i].time) {
            activeIndex = i;
        } else {
            break;
        }
    }
    
    var themeColor = settings.themeColor || '#7c3aed';
    if (themeColor !== cachedThemeColor) {
        cachedThemeColor = themeColor;
        cachedThemeR2 = parseInt(themeColor.slice(1, 3), 16);
        cachedThemeG2 = parseInt(themeColor.slice(3, 5), 16);
        cachedThemeB2 = parseInt(themeColor.slice(5, 7), 16);
    }
    
    for (var i = 0; i < lyricsData.length; i++) {
        var ele = lyricsData[i].ele;
        if (!ele) continue;
        
        var isActive = (i === activeIndex);
        var p = ele.querySelector('p');
        if (!p) continue;
        
        var yrc = lyricsData[i].yrc;
        var hasYrcChars = yrc && p.classList.contains('lyric-yrc-line');
        
        if (hasYrcChars) {
            var spans = p.querySelectorAll('.lyric-char');
            for (var si = 0; si < spans.length; si++) {
                var span = spans[si];
                var charStart = parseFloat(span.dataset.charStart);
                var charDuration = parseFloat(span.dataset.charDuration);
                
                if (!isActive) {
                    span.style.color = 'rgba(255,255,255,0.2)';
                } else if (currentTime < charStart) {
                    span.style.color = 'rgba(255,255,255,1)';
                } else if (currentTime >= charStart + charDuration) {
                    span.style.color = themeColor;
                } else {
                    var charProgress = (currentTime - charStart) / charDuration;
                    var r = Math.round(255 + (cachedThemeR2 - 255) * charProgress);
                    var g = Math.round(255 + (cachedThemeG2 - 255) * charProgress);
                    var b = Math.round(255 + (cachedThemeB2 - 255) * charProgress);
                    span.style.color = 'rgb(' + r + ',' + g + ',' + b + ')';
                }
            }
        } else {
            p.style.background = 'none';
            p.style.backgroundClip = 'unset';
            p.style.webkitBackgroundClip = 'unset';
            p.style.webkitTextFillColor = 'unset';
            p.style.color = ''
            
            if (isActive) {
                p.style.color = 'rgba(255,255,255,1)';
            } else {
                p.style.color = 'rgba(255,255,255,0.2)';
            }
        }
        
        var transP = ele.querySelector('.lyric-translation');
        if (transP) {
            transP.style.color = isActive ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)';
        }
    }
    
    if (activeIndex !== -1 && activeIndex !== lastLyricIndex) {
        lastLyricIndex = activeIndex;
        UpdateLyricsLayout(activeIndex, lyricsData, 1);
    }
    
    updateFloatingLyrics(activeIndex);
}

function updateFloatingLyrics(activeIndex) {
    if (!floatingLyrics || !floatingLyricsText || !floatingLyricsTrans) return;
    if (!settings.floatingLyricsEnabled) { floatingLyrics.classList.remove('visible'); floatingLyrics.style.opacity = '0'; return; }
    if (activeIndex === -1 || !lyricsData[activeIndex]) {
        floatingLyrics.classList.remove('visible');
        floatingLyrics.style.opacity = '0';
        return;
    }
    var item = lyricsData[activeIndex];
    if (!item.text || item.text.trim() === '') {
        floatingLyrics.classList.remove('visible');
        floatingLyrics.style.opacity = '0';
        return;
    }

    var textChanged = floatingLyricsText.textContent !== item.text;
    var transChanged = floatingLyricsTrans.textContent !== (item.translation || '');

    floatingLyrics.classList.add('visible');
    var textOpacity = settings.floatingLyricsOpacity !== undefined ? settings.floatingLyricsOpacity : 100;
    floatingLyrics.style.opacity = (textOpacity / 100).toString();

    if (textChanged) {
        floatingLyricsText.style.animation = 'none';
        floatingLyricsText.offsetHeight;
        floatingLyricsText.style.animation = '';
    }
    floatingLyricsText.textContent = item.text;

    if (item.translation) {
        if (transChanged) {
            floatingLyricsTrans.style.animation = 'none';
            floatingLyricsTrans.offsetHeight;
            floatingLyricsTrans.style.animation = '';
        }
        floatingLyricsTrans.textContent = item.translation;
        floatingLyricsTrans.style.display = 'block';
    } else {
        floatingLyricsTrans.textContent = '';
        floatingLyricsTrans.style.display = 'none';
    }
}

var lyricsRafId = null;
function startLyricsRaf() {
    if (lyricsRafId) return;
    function loop() {
        if (lyricsData.length > 0 && !lyricsLoading && isPlaying) {
            updateLyrics(audioPlayer.currentTime);
        }
        lyricsRafId = requestAnimationFrame(loop);
    }
    lyricsRafId = requestAnimationFrame(loop);
}
function stopLyricsRaf() {
    if (lyricsRafId) {
        cancelAnimationFrame(lyricsRafId);
        lyricsRafId = null;
    }
}

function applyFloatingLyricsStyle() {
    if (!floatingLyrics) return;
    var color = settings.floatingLyricsColor || '#ffffff';
    var size = settings.floatingLyricsSize || 18;
    var bgOpacity = settings.floatingLyricsBgOpacity || 0;
    var textOpacity = settings.floatingLyricsOpacity !== undefined ? settings.floatingLyricsOpacity : 100;
    var xPos = settings.floatingLyricsX !== undefined ? settings.floatingLyricsX : 50;
    var yPos = settings.floatingLyricsY !== undefined ? settings.floatingLyricsY : 0;

    var opacityValue = textOpacity / 100;
    floatingLyrics.style.color = color;
    floatingLyrics.style.fontSize = size + 'px';
    floatingLyrics.style.left = xPos + '%';
    floatingLyrics.style.transform = 'translateX(-50%) translateY(' + yPos + 'px)';
    floatingLyrics.style.bottom = 'calc(var(--player-height) + 8px)';

    if (floatingLyricsText) {
        floatingLyricsText.style.color = color;
        floatingLyricsText.style.fontSize = size + 'px';
        floatingLyricsText.style.opacity = opacityValue;
        floatingLyricsText.style.textShadow = '0 0 6px rgba(0,0,0,0.8), 0 0 16px rgba(0,0,0,0.6), 0 1px 2px rgba(0,0,0,0.9)';
    }
    if (floatingLyricsTrans) {
        floatingLyricsTrans.style.color = color;
        floatingLyricsTrans.style.fontSize = (size - 3) + 'px';
        floatingLyricsTrans.style.opacity = opacityValue * 0.85;
        floatingLyricsTrans.style.textShadow = '0 0 4px rgba(0,0,0,0.7), 0 0 10px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.8)';
    }

    if (bgOpacity > 0) {
        floatingLyrics.style.background = 'rgba(0,0,0,' + (bgOpacity / 100) + ')';
        floatingLyrics.style.padding = '8px 20px';
        floatingLyrics.style.borderRadius = '12px';
    } else {
        floatingLyrics.style.background = '';
        floatingLyrics.style.padding = '0 16px';
        floatingLyrics.style.borderRadius = '';
    }
}

// ============================================
// showNoLyrics - 保持不变
// ============================================
function showNoLyrics() {
    lyricsContainer.innerHTML = '<div class="no-lyrics" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:rgba(255,255,255,0.7);"><i class="fas fa-microphone-alt" style="font-size:48px;margin-bottom:16px;"></i><p>暂无歌词</p></div>';
    if (floatingLyrics) { floatingLyrics.classList.remove('visible'); floatingLyrics.style.opacity = '0'; }
}

// ============================================
// 全屏播放器
// ============================================
function openFullscreenPlayer() {
    if (!audioPlayer.src) { showToast('请先选择一首歌曲', 'warning'); return; }
    if (fullscreenPlayer.classList.contains('show')) return;
    var bottomNav = document.getElementById('mobileBottomNav');
    if (bottomNav) bottomNav.style.display = 'none';
    var sourceCover = nowPlayingCover;
    var targetCover = fullscreenCover;
    fullscreenPlayer.classList.add('show', 'opening');
    document.body.style.overflow = 'hidden';
    fullscreenCover.classList.toggle('playing', isPlaying && settings.coverRotation);
    fullscreenCover.classList.toggle('cover-rotation', settings.coverRotation);
    fullscreenPlayIcon.className = isPlaying ? 'fas fa-pause' : 'fas fa-play';
    if (settings.showLyrics) { lyricsContainer.style.display = 'block'; }
    else { lyricsContainer.style.display = 'none'; }
    void fullscreenPlayer.offsetHeight;
    var sourceRect = sourceCover.getBoundingClientRect();
    var targetRect = targetCover.getBoundingClientRect();
    var clone = document.createElement('div');
    clone.className = 'clone-cover';
    var srcImg = sourceCover.querySelector('img');
    if (srcImg && srcImg.src) {
        var imgClone = document.createElement('img');
        imgClone.src = srcImg.src;
        imgClone.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;filter:blur(8px);transition:filter 0.35s ease;';
        clone.appendChild(imgClone);
    } else {
        clone.innerHTML = sourceCover.innerHTML;
        var inner = clone.querySelector('img');
        if (inner) { inner.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;filter:blur(8px);transition:filter 0.35s ease;'; }
    }
    clone.style.cssText = '\n        position: fixed;\n        z-index: 9999;\n        width: ' + sourceRect.width + 'px;\n        height: ' + sourceRect.height + 'px;\n        left: ' + sourceRect.left + 'px;\n        top: ' + sourceRect.top + 'px;\n        border-radius: ' + getComputedStyle(sourceCover).borderRadius + ';\n        transform: none;\n        overflow: hidden;\n        transition: none;\n        pointer-events: none;\n    ';
    document.body.appendChild(clone);
    var savedTransition = targetCover.style.transition;
    targetCover.style.transition = 'none';
    sourceCover.style.opacity = '0';
    targetCover.style.opacity = '0';
    void targetCover.offsetHeight;
    startLyricsRaf();
    clone.getBoundingClientRect();
    clone.style.transition = 'width 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94), height 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94), left 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94), top 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94), border-radius 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94), filter 0.35s ease';
    clone.style.width = targetRect.width + 'px';
    clone.style.height = targetRect.height + 'px';
    clone.style.left = targetRect.left + 'px';
    clone.style.top = targetRect.top + 'px';
    clone.style.borderRadius = getComputedStyle(targetCover).borderRadius;
    clone.style.filter = 'blur(0)';
    fullscreenPlayer.classList.remove('opening');
    setTimeout(function() {
        if (clone && clone.parentNode) document.body.removeChild(clone);
        sourceCover.style.opacity = ''
        targetCover.style.transition = 'none';
        targetCover.style.opacity = '';
        void targetCover.offsetHeight;
        targetCover.style.transition = savedTransition;
        fullscreenPlayer.classList.remove('opening');
    }, 350);
}

function closeFullscreenPlayer() {
    if (!fullscreenPlayer.classList.contains('show')) return;
    var sourceCover = fullscreenCover;
    var targetCover = nowPlayingCover;
    var sourceRect = sourceCover.getBoundingClientRect();
    var targetRect = targetCover.getBoundingClientRect();
    var clone = document.createElement('div');
    clone.className = 'clone-cover';
    var srcImg = sourceCover.querySelector('img');
    if (srcImg && srcImg.src) {
        var imgClone = document.createElement('img');
        imgClone.src = srcImg.src;
        imgClone.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
        clone.appendChild(imgClone);
    } else {
        clone.innerHTML = sourceCover.innerHTML;
        var inner = clone.querySelector('img');
        if (inner) { inner.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;'; }
    }
    clone.style.cssText = '\n        position: fixed;\n        z-index: 9999;\n        width: ' + sourceRect.width + 'px;\n        height: ' + sourceRect.height + 'px;\n        left: ' + sourceRect.left + 'px;\n        top: ' + sourceRect.top + 'px;\n        border-radius: ' + getComputedStyle(sourceCover).borderRadius + ';\n        transform: none;\n        overflow: hidden;\n        filter: blur(6px);\n        transition: none;\n        pointer-events: none;\n    ';
    document.body.appendChild(clone);
    var savedTransition = sourceCover.style.transition;
    sourceCover.style.transition = 'none';
    sourceCover.style.opacity = '0';
    targetCover.style.opacity = '0';
    void sourceCover.offsetHeight;
    fullscreenPlayer.classList.add('closing');
    clone.getBoundingClientRect();
    clone.style.transition = 'width 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94), height 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94), left 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94), top 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94), border-radius 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94), filter 0.3s ease';
    clone.style.width = targetRect.width + 'px';
    clone.style.height = targetRect.height + 'px';
    clone.style.left = targetRect.left + 'px';
    clone.style.top = targetRect.top + 'px';
    clone.style.borderRadius = getComputedStyle(targetCover).borderRadius;
    clone.style.filter = 'blur(0)';
    setTimeout(function() {
        if (clone && clone.parentNode) document.body.removeChild(clone);
        targetCover.style.opacity = '';
        sourceCover.style.transition = savedTransition;
        fullscreenPlayer.classList.remove('show', 'opening', 'closing');
        document.body.style.overflow = '';
        var bottomNav = document.getElementById('mobileBottomNav');
        if (bottomNav) bottomNav.style.display = '';
    }, 300);
}

// ============================================
// UI 辅助函数
// ============================================
function showLoading(container, message) {
    container.innerHTML = '<div class="loading"><div class="win-spinner win-spinner-sm"><div class="win-spinner-wrapper"><div class="win-spinner-item"><div class="win-spinner-ball"></div></div><div class="win-spinner-item"><div class="win-spinner-ball"></div></div><div class="win-spinner-item"><div class="win-spinner-ball"></div></div><div class="win-spinner-item"><div class="win-spinner-ball"></div></div><div class="win-spinner-item"><div class="win-spinner-ball"></div></div></div></div><p>' + message + '</p></div>';
}
function hidePageLoader() {
    var loader = document.getElementById('pageLoader');
    if (loader && !loader.classList.contains('hidden')) {
        loader.classList.add('hidden');
    }
}

function markAnimationDone(container, selector) {
    container.querySelectorAll(selector).forEach(function(el) {
        var delay = parseFloat(el.style.animationDelay) || 0;
        setTimeout(function() { el.classList.add('anim-done'); }, delay * 1000 + 500);
    });
}
function displayResults(songs, container, type) {
    type = type || 'search';
    if (!songs || songs.length === 0) { displayEmptyResults(container, '未找到相关歌曲', '请尝试其他关键词'); return; }

    if (type === 'search') resultsCount.textContent = songs.length + ' 首歌曲';

    renderLazyCards(container, songs, function(song, index) {
        var isFavorited = favorites.some(function(f) { return String(f.id) === String(song.id); });
        var minutes = Math.floor((song.duration || 0) / 60000);
        var seconds = Math.floor(((song.duration || 0) % 60000) / 1000).toString().padStart(2, '0');
        var isDownloadDisabled = !isLoggedIn;
        var hasCover = song.picurl && song.picurl.trim() !== '';
        var bgStyle = hasCover ? 'background-image: url(\'' + song.picurl + '\'); background-size: cover; background-position: center;' : '';
        return '<div class="song-card ' + (isFavorited ? 'favorited' : '') + ' ' + (_activeSongId && String(song.id) === String(_activeSongId) ? 'active' : '') + '" data-id="' + song.id + '" style="animation-delay: ' + (index * 0.05) + 's; ' + bgStyle + '"><div class="song-card-bg-blur"></div><div class="song-cover">' + (hasCover ? '<img src="' + song.picurl + '" alt="' + escapeHtml(song.name) + '" onload="this.parentElement.classList.add(\'has-image\')" onerror="this.onerror=null; this.style.display=\'none\'">' : '') + '<i class="fas fa-music"></i>' + (_activeSongId && String(song.id) === String(_activeSongId) && isPlaying ? '<div class="song-playing-indicator"><i class="fas fa-play"></i></div>' : '') + '</div><div class="song-info"><div class="song-title"><span class="song-title-text">' + escapeHtml(song.name) + '</span>' + (isFavorited ? '<i class="fas fa-heart" style="color:var(--accent); font-size:12px;"></i>' : '') + '<span class="platform-badge ' + (song.platform === 'kuwo' ? 'kuwo' : 'netease') + '" style="font-size:10px;padding:2px 6px;border-radius:10px;background:' + (song.platform === 'kuwo' ? 'rgba(255,152,0,0.2)' : 'rgba(236,65,65,0.2)') + ';color:' + (song.platform === 'kuwo' ? '#FF9800' : '#EC4141') + ';margin-left:8px;flex-shrink:0;">' + (song.platform === 'kuwo' ? '酷我' : '网易') + '</span></div><div class="song-artist">' + escapeHtml(song.artistsname) + '</div><div class="song-duration"><i class="far fa-clock"></i><span>' + minutes + ':' + seconds + '</span></div></div><div class="song-actions"><button class="action-btn play" data-index="' + index + '"><i class="fas fa-play"></i></button><button class="action-btn add-to-playlist" data-id="' + song.id + '" data-name="' + escapeAttr(song.name) + '" data-artist="' + escapeAttr(song.artistsname) + '" data-album="' + escapeAttr(song.album || '') + '" data-pic="' + escapeAttr(song.picurl || '') + '" data-platform="' + song.platform + '" data-kuwo-rid="' + (song.kuwo_rid || '') + '"><i class="fas fa-plus"></i></button><button class="action-btn favorite ' + (isFavorited ? 'active' : '') + '" data-id="' + song.id + '"><i class="fas ' + (isFavorited ? 'fa-heart' : 'fa-heart') + '"></i></button><button class="action-btn download ' + (isDownloadDisabled ? 'disabled' : '') + '" data-id="' + song.id + '" title="' + (isDownloadDisabled ? '请先登录后下载' : '下载歌曲') + '"><i class="fas fa-download"></i></button></div></div>';
    }, function(card, song, index) {
        bindSongCardEvents(card, song, index, songs);
    }, 'song-card-placeholder');
}

function bindSongCardEvents(card, song, index, songs) {
    var playBtn = card.querySelector('.action-btn.play');
    if (playBtn) {
        playBtn.addEventListener('click', function(e) { e.stopPropagation(); playSong(song, index); });
    }
    var favBtn = card.querySelector('.action-btn.favorite');
    if (favBtn) {
        favBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            var id = String(favBtn.dataset.id);
            if (favBtn.classList.contains('active')) {
                removeFromFavorites(id);
                favBtn.classList.remove('active');
                card.classList.remove('favorited');
            } else {
                if (addToFavorites(song)) {
                    favBtn.classList.add('active');
                    card.classList.add('favorited');
                }
            }
        });
    }
    var dlBtn = card.querySelector('.action-btn.download');
    if (dlBtn) {
        dlBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (!dlBtn.classList.contains('disabled')) downloadSong(song);
            else { showToast('请先登录后下载歌曲', 'warning'); loginModal.classList.add('active'); }
        });
    }
    var plBtn = card.querySelector('.action-btn.add-to-playlist');
    if (plBtn) {
        plBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            showAddToPlaylistModal({
                id: plBtn.dataset.id,
                name: plBtn.dataset.name,
                artistsname: plBtn.dataset.artist,
                album: plBtn.dataset.album,
                picurl: plBtn.dataset.pic,
                platform: plBtn.dataset.platform,
                kuwo_rid: plBtn.dataset.kuwoRid
            });
        });
    }
    card.addEventListener('click', function(e) {
        if (batchMode && (e.target.closest('.batch-checkbox') || e.target.closest('.song-card'))) return;
        if (!e.target.closest('.song-actions')) {
            playSong(song, index);
        }
    });
}
function displayHistoryResults(songs, container) {
    if (!songs || songs.length === 0) { displayEmptyResults(container, '未找到播放历史', '开始播放歌曲后这里会显示记录'); return; }

    renderLazyCards(container, songs, function(song, index) {
        var isFavorited = favorites.some(function(f) { return String(f.id) === String(song.id); });
        var isDownloadDisabled = !isLoggedIn;
        var hasCover = song.picurl && song.picurl.trim() !== '';
        var lastPlayed = song.historyInfo ? new Date(song.historyInfo.lastPlayed).toLocaleString() : '';
        var playCount = song.historyInfo ? song.historyInfo.playCount : 1;
        var bgStyle = hasCover ? 'background-image: url(\'' + song.picurl + '\'); background-size: cover; background-position: center;' : '';
        return '<div class="song-card ' + (isFavorited ? 'favorited' : '') + ' ' + (_activeSongId && String(song.id) === String(_activeSongId) ? 'active' : '') + '" data-id="' + song.id + '" style="animation-delay: ' + (index * 0.05) + 's; ' + bgStyle + '"><div class="song-card-bg-blur"></div><div class="song-cover">' + (hasCover ? '<img src="' + song.picurl + '" alt="' + escapeHtml(song.name) + '" onload="this.parentElement.classList.add(\'has-image\')" onerror="this.onerror=null; this.style.display=\'none\'">' : '') + '<i class="fas fa-history"></i>' + (_activeSongId && String(song.id) === String(_activeSongId) && isPlaying ? '<div class="song-playing-indicator"><i class="fas fa-play"></i></div>' : '') + '</div><div class="song-info"><div class="song-title"><span class="song-title-text">' + escapeHtml(song.name) + '</span>' + (isFavorited ? '<i class="fas fa-heart" style="color:var(--accent); font-size:12px;"></i>' : '') + '<span class="platform-badge ' + (song.platform === 'kuwo' ? 'kuwo' : 'netease') + '" style="font-size:10px;padding:2px 6px;border-radius:10px;background:' + (song.platform === 'kuwo' ? 'rgba(255,152,0,0.2)' : 'rgba(236,65,65,0.2)') + ';color:' + (song.platform === 'kuwo' ? '#FF9800' : '#EC4141') + ';margin-left:8px;flex-shrink:0;">' + (song.platform === 'kuwo' ? '酷我' : '网易') + '</span></div><div class="song-artist">' + escapeHtml(song.artistsname) + '</div><div class="song-duration"><i class="fas fa-history"></i><span>播放 ' + playCount + ' 次</span></div><div style="font-size:10px;color:var(--text-secondary);margin-top:3px;">最后播放: ' + lastPlayed + '</div></div><div class="song-actions"><button class="action-btn play" data-index="' + index + '"><i class="fas fa-play"></i></button><button class="action-btn add-to-playlist" data-id="' + song.id + '" data-name="' + escapeAttr(song.name) + '" data-artist="' + escapeAttr(song.artistsname) + '" data-album="' + escapeAttr(song.album || '') + '" data-pic="' + escapeAttr(song.picurl || '') + '" data-platform="' + song.platform + '" data-kuwo-rid="' + (song.kuwo_rid || '') + '"><i class="fas fa-plus"></i></button><button class="action-btn favorite ' + (isFavorited ? 'active' : '') + '" data-id="' + song.id + '"><i class="fas ' + (isFavorited ? 'fa-heart' : 'fa-heart') + '"></i></button><button class="action-btn download ' + (isDownloadDisabled ? 'disabled' : '') + '" data-id="' + song.id + '" title="' + (isDownloadDisabled ? '请先登录后下载' : '下载歌曲') + '"><i class="fas fa-download"></i></button></div></div>';
    }, function(card, song, index) {
        bindSongCardEvents(card, song, index, songs);
    }, 'song-card-placeholder');
}
function updateFavoritesPage() {
    if (!favoritesList) return;
    if (favorites.length === 0) { favoritesList.innerHTML = '<div class="empty-state"><i class="fas fa-heart"></i><h3>暂无收藏歌曲</h3><p>在搜索结果中点击心形图标添加歌曲到收藏</p></div>'; return; }
    displayResults(favorites, favoritesList, 'favorites');
}
function displayEmptyResults(container, title, message) {
    container.innerHTML = '<div class="empty-state"><i class="fas fa-search"></i><h3>' + title + '</h3><p>' + message + '</p></div>';
}
function switchPage(page) {
    if (page === currentPage) return;
    if (settings.rememberLastPosition) saveCurrentPagePosition();
    if (!_isPoppingState) {
        _navStack.push(page);
        history.pushState({ page: page }, '', window.location.href);
    }
    pageContents.forEach(function(content) { content.classList.remove('active'); });
    var target = document.getElementById('page' + page.charAt(0).toUpperCase() + page.slice(1));
    if (target) { target.classList.add('active'); currentPage = page; if (page === 'hotlist') setTimeout(function() { if (!hotSongList || hotSongList.children.length === 0 || hotSongList.innerHTML.includes('empty-state')) loadChartByType(currentChartType); }, 100); if (page === 'history') updateHistoryPage(); if (page === 'favorites') updateFavoritesPage(); if (page === 'playlists') updatePlaylistsPage(); else if (playlistEditMode) togglePlaylistEditMode(); if (page === 'playlistDetail') { if (currentPlaylistId) updatePlaylistDetailPage(currentPlaylistId); } else if (playlistSongsEditMode) togglePlaylistSongsEditMode(); if (page === 'settings') updateSettingsPage(); }
    var mobileNav = document.getElementById('mobileBottomNav');
    if (mobileNav) {
        var inner = mobileNav.querySelector('.mobile-bottom-nav-inner');
        if (inner) {
            inner.querySelectorAll('.mobile-nav-item').forEach(function(it) { it.classList.remove('active'); });
            var navItem = inner.querySelector('.mobile-nav-item[data-page="' + page + '"]');
            if (navItem) navItem.classList.add('active');
        }
    }
}
function setActiveNav(activeNav) {
    navItems.forEach(function(nav) { nav.classList.remove('active'); });
    activeNav.classList.add('active');
}
function updateVolumeUI() {
    volumeLevel.style.transform = 'scaleY(' + volume + ')';
    if (volume === 0) volumeIcon.className = 'fas fa-volume-mute';
    else if (volume < 0.5) volumeIcon.className = 'fas fa-volume-down';
    else volumeIcon.className = 'fas fa-volume-up';
}
function showNotification(message, type) {
    type = type || 'success';
    notificationText.textContent = message;
    notification.className = 'notification ' + type + ' show';
    setTimeout(function() { notification.classList.remove('show'); }, 3000);
}

// ============================================
// Toast 系统
// ============================================
var toastQueue = [];
var isToastShowing = false;
var toastContainerEl = null;
function initToastContainer() {
    if (!toastContainerEl) {
        toastContainerEl = document.getElementById('toastContainer');
        if (!toastContainerEl) { toastContainerEl = document.createElement('div'); toastContainerEl.id = 'toastContainer'; toastContainerEl.className = 'toast-container'; document.body.appendChild(toastContainerEl); }
    }
    return toastContainerEl;
}
function showToast(message, type, duration) {
    type = type || 'success';
    var baseDuration = duration || 2500;
    var queueLength = toastQueue.length;
    if (queueLength > 0) {
        var factor = Math.min(1 + queueLength * 0.35, 4);
        baseDuration = Math.max(Math.round(baseDuration / factor), 600);
    }
    toastQueue.push({ message: message, type: type, duration: baseDuration });
    if (!isToastShowing) processToastQueue();
}
function processToastQueue() {
    if (toastQueue.length === 0) { isToastShowing = false; return; }
    isToastShowing = true;
    var item = toastQueue.shift();
    displaySingleToast(item.message, item.type, item.duration);
}
function displaySingleToast(message, type, duration) {
    initToastContainer();
    var toast = document.createElement('div');
    toast.className = 'toast-notification ' + type + ' enter';
    var icon = ''
    switch(type) {
        case 'success': icon = '<i class="fas fa-check-circle"></i>'; break;
        case 'error': icon = '<i class="fas fa-exclamation-circle"></i>'; break;
        case 'warning': icon = '<i class="fas fa-exclamation-triangle"></i>'; break;
        default: icon = '<i class="fas fa-info-circle"></i>';
    }
    toast.innerHTML = icon + '<span class="toast-message">' + escapeHtml(message) + '</span>';
    toastContainerEl.appendChild(toast);
    toast.addEventListener('click', function() { hideCurrentAndShowNext(toast); });
    var timer = setTimeout(function() { if (toast && toast.parentNode) hideCurrentAndShowNext(toast); }, duration);
    toast._hideTimer = timer;
}
function hideCurrentAndShowNext(toast) {
    if (!toast || !toast.parentNode) { processToastQueue(); return; }
    if (toast._hideTimer) clearTimeout(toast._hideTimer);
    toast.classList.remove('enter'); toast.classList.add('exit');
    setTimeout(function() { if (toast && toast.parentNode) toast.parentNode.removeChild(toast); processToastQueue(); }, 250);
}
function clearAllToasts() { toastQueue = []; if (toastContainerEl) { toastContainerEl.querySelectorAll('.toast-notification').forEach(function(t) { if (t._hideTimer) clearTimeout(t._hideTimer); t.remove(); }); } isToastShowing = false; }
function showError(message) { errorText.textContent = message; errorMessage.classList.add('show'); setTimeout(function() { errorMessage.classList.remove('show'); }, 5000); }
function hideError() { errorMessage.classList.remove('show'); }

// ============================================
// 键盘快捷键
// ============================================
function handleKeyDown(e) {
    var tagName = e.target.tagName.toLowerCase();
    if (tagName === 'input' || tagName === 'textarea') {
        return;
    }
    switch (e.key) {
        case 'ArrowLeft':
            if (e.ctrlKey) playPrev();
            break;
        case 'ArrowRight':
            if (e.ctrlKey) playNext();
            break;
        case 'Escape':
            if (fullscreenPlayer.classList.contains('show')) closeFullscreenPlayer();
            break;
        case 'f':
        case 'F':
            if (e.ctrlKey && audioPlayer.src) {
                e.preventDefault();
                if (fullscreenPlayer.classList.contains('show')) closeFullscreenPlayer();
                else openFullscreenPlayer();
            }
            break;
    }
}

// ============================================
// 播放队列面板
// ============================================
var queuePanel = document.getElementById('queuePanel');
var queuePanelOverlay = document.getElementById('queuePanelOverlay');
var queuePanelList = document.getElementById('queuePanelList');
var queueCount = document.getElementById('queueCount');
var queueBtn = document.getElementById('queueBtn');
var closeQueuePanel = document.getElementById('closeQueuePanel');
var clearQueueBtn = document.getElementById('clearQueueBtn');
var queueBadge = document.createElement('span');
queueBadge.className = 'queue-badge';
if (queueBtn) queueBtn.appendChild(queueBadge);

function openQueuePanel() {
    if (!queuePanel || !queuePanelOverlay) return;
    renderQueuePanel();
    queuePanel.classList.add('active');
    queuePanelOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeQueuePanelFn() {
    if (!queuePanel || !queuePanelOverlay) return;
    queuePanel.classList.remove('active');
    queuePanelOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

function renderQueuePanel() {
    if (!queuePanelList) return;
    if (currentSongs.length === 0) {
        queuePanelList.innerHTML = '<div class="empty-state"><i class="fas fa-list-ul"></i><p>队列为空</p></div>';
        if (queueCount) queueCount.textContent = '0';
        return;
    }
    if (queueCount) queueCount.textContent = currentSongs.length;
    var html = '';
    currentSongs.forEach(function(song, index) {
        var isCurrent = index === currentIndex;
        var hasCover = song.picurl && song.picurl.trim() !== '';
        html += '<div class="queue-song-item' + (isCurrent ? ' current' : '') + '" data-index="' + index + '">';
        html += '<div class="queue-song-index">' + (isCurrent && isPlaying ? '<i class="fas fa-play"></i>' : (index + 1)) + '</div>';
        html += '<div class="queue-song-cover">' + (hasCover ? '<img src="' + song.picurl + '" alt="">' : '<i class="fas fa-music"></i>') + '</div>';
        html += '<div class="queue-song-info"><div class="queue-song-name">' + escapeHtml(song.name) + '</div><div class="queue-song-artist">' + escapeHtml(song.artistsname) + '</div></div>';
        html += '<button class="queue-song-remove" data-index="' + index + '" title="从队列中移除"><i class="fas fa-times"></i></button>';
        html += '</div>';
    });
    queuePanelList.innerHTML = html;

    queuePanelList.querySelectorAll('.queue-song-item').forEach(function(item) {
        item.addEventListener('click', function(e) {
            if (e.target.closest('.queue-song-remove')) return;
            var idx = parseInt(item.dataset.index);
            if (idx >= 0 && idx < currentSongs.length) {
                playSong(currentSongs[idx], idx);
                closeQueuePanelFn();
            }
        });
    });
    queuePanelList.querySelectorAll('.queue-song-remove').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            var idx = parseInt(btn.dataset.index);
            removeFromQueue(idx);
        });
    });
}

function removeFromQueue(index) {
    if (index < 0 || index >= currentSongs.length) return;
    currentSongs.splice(index, 1);
    if (index < currentIndex) currentIndex--;
    else if (index === currentIndex && currentSongs.length === 0) currentIndex = -1;
    else if (currentIndex >= currentSongs.length) currentIndex = currentSongs.length - 1;
    renderQueuePanel();
    updateQueueBadge();
}

function clearQueue() {
    currentSongs = [];
    currentIndex = -1;
    renderQueuePanel();
    updateQueueBadge();
    showToast('队列已清空', 'info');
}

function updateQueueBadge() {
    if (!queueBadge) return;
    var count = currentSongs.length;
    if (count > 0) {
        queueBadge.textContent = count > 99 ? '99+' : count;
        queueBadge.classList.add('visible');
    } else {
        queueBadge.classList.remove('visible');
    }
}

if (closeQueuePanel) closeQueuePanel.addEventListener('click', closeQueuePanelFn);
if (queuePanelOverlay) queuePanelOverlay.addEventListener('click', closeQueuePanelFn);
if (queueBtn) queueBtn.addEventListener('click', function() {
    if (queuePanel && queuePanel.classList.contains('active')) closeQueuePanelFn();
    else openQueuePanel();
});
if (clearQueueBtn) clearQueueBtn.addEventListener('click', clearQueue);

// ============================================
// 批量操作
// ============================================
var batchMode = false;
var batchModeType = '';
var selectedSongs = {};
var batchBar = document.getElementById('batchBar');
var batchSelectAll = document.getElementById('batchSelectAll');
var batchCount = document.getElementById('batchCount');
var batchCancelBtn = document.getElementById('batchCancelBtn');
var batchAddToPlaylistBtn = document.getElementById('batchAddToPlaylistBtn');
var batchDownloadBtn = document.getElementById('batchDownloadBtn');
var batchRemoveBtn = document.getElementById('batchRemoveBtn');

function getBatchSongs() {
    if (batchModeType === 'favorites') return favorites;
    if (batchModeType === 'history') return playHistory.map(function(r) { return r.song; });
    if (batchModeType === 'search') return currentSongs;
    if (batchModeType === 'playlist' && currentPlaylistId) { var pl = findPlaylist(currentPlaylistId); return pl ? pl.songs : []; }
    return currentSongs;
}

function toggleBatchMode(type) {
    if (batchMode && batchModeType === type) {
        exitBatchMode();
        return;
    }
    if (batchMode) exitBatchMode();
    batchMode = true;
    batchModeType = type;
    selectedSongs = {};
    if (batchSelectAll) batchSelectAll.checked = false;
    if (batchBar) batchBar.classList.add('active');
    if (batchCount) batchCount.textContent = '已选 0 首';
    if (batchRemoveBtn) batchRemoveBtn.style.display = type === 'playlist' ? '' : 'none';
    if (batchAddToPlaylistBtn) batchAddToPlaylistBtn.style.display = type === 'playlist' ? 'none' : '';
    if (batchDownloadBtn) batchDownloadBtn.style.display = type === 'playlist' ? 'none' : '';

    var containerId = type === 'search' ? 'resultsList' : (type === 'favorites' ? 'favoritesList' : (type === 'history' ? 'historyList' : 'playlistDetailList'));
    var container = document.getElementById(containerId);
    if (container) container.classList.add('batch-mode');

    var btnId = type === 'search' ? 'searchBatchBtn' : (type === 'favorites' ? 'favoritesBatchBtn' : (type === 'history' ? 'historyBatchBtn' : 'playlistBatchBtn'));
    var btn = document.getElementById(btnId);
    if (btn) btn.classList.add('active');

    var songs = getBatchSongs();
    var selector = type === 'playlist' ? '.song-item' : '.song-card';
    songs.forEach(function(song, index) {
        var card = container.querySelector(selector + '[data-id="' + song.id + '"]');
        if (!card) { card = container.querySelector(selector + '[data-index="' + index + '"]'); }
        if (card && !card.querySelector('.batch-checkbox')) {
            var checkbox = document.createElement('label');
            checkbox.className = 'custom-checkbox batch-checkbox';
            checkbox.innerHTML = '<input type="checkbox" data-id="' + song.id + '"><span class="checkmark-box"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>';
            card.appendChild(checkbox);
            var input = checkbox.querySelector('input');
            input.addEventListener('change', function(e) {
                e.stopPropagation();
                var id = this.dataset.id;
                if (this.checked) { selectedSongs[id] = true; } else { delete selectedSongs[id]; }
                updateBatchCount();
            });
        }
        card.addEventListener('click', function(e) {
            if (e.target.closest('.batch-checkbox') || e.target.closest('input')) return;
            var input = this.querySelector('.batch-checkbox input');
            if (input) {
                input.checked = !input.checked;
                var id = input.dataset.id;
                if (input.checked) { selectedSongs[id] = true; } else { delete selectedSongs[id]; }
                updateBatchCount();
            }
        });
    });
}

function exitBatchMode() {
    batchMode = false;
    batchModeType = '';
    selectedSongs = {};
    if (batchBar) batchBar.classList.remove('active');
    if (batchSelectAll) batchSelectAll.checked = false;
    if (batchCount) batchCount.textContent = '已选 0 首';
    if (batchRemoveBtn) batchRemoveBtn.style.display = 'none';
    if (batchAddToPlaylistBtn) batchAddToPlaylistBtn.style.display = '';
    if (batchDownloadBtn) batchDownloadBtn.style.display = '';

    ['resultsList', 'favoritesList', 'historyList', 'playlistDetailList'].forEach(function(id) {
        var container = document.getElementById(id);
        if (container) {
            container.classList.remove('batch-mode');
            container.querySelectorAll('.song-card.selected, .song-item.selected').forEach(function(c) { c.classList.remove('selected'); });
            container.querySelectorAll('.batch-checkbox').forEach(function(cb) { cb.remove(); });
        }
    });
    ['searchBatchBtn', 'favoritesBatchBtn', 'historyBatchBtn', 'playlistBatchBtn'].forEach(function(id) {
        var btn = document.getElementById(id);
        if (btn) btn.classList.remove('active');
    });
}

function updateBatchCount() {
    var count = Object.keys(selectedSongs).length;
    if (batchCount) batchCount.textContent = '已选 ' + count + ' 首';
    if (batchSelectAll) {
        var songs = getBatchSongs();
        batchSelectAll.checked = count > 0 && count === songs.length;
    }
    var containerId = batchModeType === 'search' ? 'resultsList' : (batchModeType === 'favorites' ? 'favoritesList' : (batchModeType === 'history' ? 'historyList' : 'playlistDetailList'));
    var container = document.getElementById(containerId);
    if (container) {
        var selector = batchModeType === 'playlist' ? '.song-item' : '.song-card';
        container.querySelectorAll(selector).forEach(function(card) {
            var input = card.querySelector('.batch-checkbox input');
            if (input && selectedSongs[input.dataset.id]) card.classList.add('selected');
            else card.classList.remove('selected');
        });
    }
}

if (batchSelectAll) batchSelectAll.addEventListener('change', function() {
    var songs = getBatchSongs();
    var containerId = batchModeType === 'search' ? 'resultsList' : (batchModeType === 'favorites' ? 'favoritesList' : (batchModeType === 'history' ? 'historyList' : 'playlistDetailList'));
    var container = document.getElementById(containerId);
    if (this.checked) {
        songs.forEach(function(s) { selectedSongs[s.id] = true; });
        if (container) container.querySelectorAll('.batch-checkbox input').forEach(function(inp) { inp.checked = true; });
    } else {
        selectedSongs = {};
        if (container) container.querySelectorAll('.batch-checkbox input').forEach(function(inp) { inp.checked = false; });
    }
    updateBatchCount();
});

if (batchCancelBtn) batchCancelBtn.addEventListener('click', exitBatchMode);

if (batchAddToPlaylistBtn) batchAddToPlaylistBtn.addEventListener('click', function() {
    var ids = Object.keys(selectedSongs);
    if (ids.length === 0) { showToast('请先选择歌曲', 'warning'); return; }
    var songs = getBatchSongs();
    var selected = songs.filter(function(s) { return selectedSongs[s.id]; });
    showBatchAddToPlaylistModal(selected);
});

if (batchDownloadBtn) batchDownloadBtn.addEventListener('click', function() {
    var ids = Object.keys(selectedSongs);
    if (ids.length === 0) { showToast('请先选择歌曲', 'warning'); return; }
    if (!isLoggedIn) { showToast('请先登录后下载', 'warning'); loginModal.classList.add('active'); return; }
    var songs = getBatchSongs();
    var selected = songs.filter(function(s) { return selectedSongs[s.id]; });
    if (selected.length > 5 && !confirm('即将下载 ' + selected.length + ' 首歌曲，是否继续？')) return;
    showToast('开始批量下载 ' + selected.length + ' 首歌曲...', 'info');
    selected.forEach(function(song, i) {
        setTimeout(function() { downloadSong(song); }, i * 800);
    });
});

if (batchRemoveBtn) batchRemoveBtn.addEventListener('click', function() {
    if (batchModeType !== 'playlist' || !currentPlaylistId) return;
    var ids = Object.keys(selectedSongs);
    if (ids.length === 0) { showToast('请先选择歌曲', 'warning'); return; }
    if (!confirm('确定要从歌单中移除 ' + ids.length + ' 首歌曲吗？')) return;
    var pl = findPlaylist(currentPlaylistId);
    if (!pl) return;
    pl.songs = pl.songs.filter(function(s) { return !selectedSongs[s.id]; });
    savePlaylists();
    updatePlaylistDetailPage(currentPlaylistId);
    updatePlaylistsPage();
    showToast('已移除 ' + ids.length + ' 首歌曲', 'info');
    exitBatchMode();
});

function showBatchAddToPlaylistModal(songs) {
    if (!playlists || playlists.length === 0) {
        showToast('请先创建歌单', 'warning');
        return;
    }
    var modal = document.getElementById('addToPlaylistModal');
    var list = document.getElementById('playlistSelectList');
    if (!modal || !list) return;
    list.innerHTML = '';
    playlists.forEach(function(pl) {
        var item = document.createElement('div');
        item.className = 'playlist-select-item';
        item.innerHTML = '<div class="playlist-select-info"><div class="playlist-select-name">' + escapeHtml(pl.name) + '</div><div class="playlist-select-count">' + pl.songs.length + ' 首</div></div><span class="playlist-select-added" style="display:none;">已添加</span>';
        item.addEventListener('click', function() {
            var added = 0;
            songs.forEach(function(song) {
                if (!pl.songs.some(function(s) { return String(s.id) === String(song.id); })) {
                    pl.songs.push(song);
                    added++;
                }
            });
            if (added > 0) savePlaylists();
            item.querySelector('.playlist-select-added').style.display = 'block';
            item.querySelector('.playlist-select-count').textContent = pl.songs.length + ' 首';
            showToast('已添加 ' + added + ' 首到「' + pl.name + '」', 'success');
            setTimeout(function() { modal.classList.remove('active'); exitBatchMode(); }, 500);
        });
        list.appendChild(item);
    });
    modal.classList.add('active');
    var closeHandler = function() { modal.classList.remove('active'); };
    document.getElementById('closeAddToPlaylistModal').addEventListener('click', closeHandler, { once: true });
}

// 批量操作按钮事件
var searchBatchBtn = document.getElementById('searchBatchBtn');
var favoritesBatchBtn = document.getElementById('favoritesBatchBtn');
var historyBatchBtn = document.getElementById('historyBatchBtn');
if (searchBatchBtn) searchBatchBtn.addEventListener('click', function() { toggleBatchMode('search'); });
if (favoritesBatchBtn) favoritesBatchBtn.addEventListener('click', function() { toggleBatchMode('favorites'); });
if (historyBatchBtn) historyBatchBtn.addEventListener('click', function() { toggleBatchMode('history'); });

var playlistBatchBtn = document.getElementById('playlistBatchBtn');
if (playlistBatchBtn) playlistBatchBtn.addEventListener('click', function() { toggleBatchMode('playlist'); });

// 页面切换时退出批量模式
var originalSwitchPage = switchPage;
switchPage = function(page) {
    if (batchMode) exitBatchMode();
    originalSwitchPage(page);
    var bottomNav = document.getElementById('mobileBottomNav');
    if (bottomNav) {
        bottomNav.querySelectorAll('.mobile-nav-item').forEach(function(it) {
            it.classList.toggle('active', it.dataset.page === page);
        });
    }
};

// 在 playSong 中更新队列面板
var originalPlaySong = playSong;
playSong = async function(song, index) {
    var result = await originalPlaySong(song, index);
    updateQueueBadge();
    if (queuePanel && queuePanel.classList.contains('active')) renderQueuePanel();
    return result;
};

// ============================================
// 启动
// ============================================
window.addEventListener('DOMContentLoaded', init);
setTimeout(function() { restoreLastPagePosition(); }, 500);