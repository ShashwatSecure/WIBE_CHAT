import React, { useState, useEffect, useRef, useCallback } from 'react';
import './MusicSidebar.css';
import './PlayButton.css';

const formatTime = (time) => {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
};



function MusicSidebar({ isOpen, onClose, currentUserId }) {
  console.log('MusicSidebar received currentUserId:', currentUserId);
  useEffect(() => {
    console.log('MusicSidebar component is rendering.');
  }, []);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false); // Added missing state
  const [isSongLoading, setIsSongLoading] = useState(false); // New state for song loading status
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState('0:00');
  const [duration, setDuration] = useState('0:00');
  const [currentPage, setCurrentPage] = useState(1); // Start with page 1
  const [loading, setLoading] = useState(false); // Loading state for new results
  const [totalResults, setTotalResults] = useState(0); // New state for total results
  const [startOffset, setStartOffset] = useState(0); // New state for start offset
  const audioRef = useRef(null);
  const searchResultsRef = useRef(null); // Ref for the scrollable search results container
  const sidebarRef = useRef(null); // Ref for the sidebar container
  const [currentPlayingSong, setCurrentPlayingSong] = useState(null); // New state for current playing song

  const fetchRecentlyPlayedSongs = useCallback(async () => {
    if (!currentUserId) return; // Don't fetch if userId is not available

    setLoading(true);
    try {
      console.log('Attempting to fetch recently played songs from backend for user:', currentUserId);
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/music/recently-played?userId=${currentUserId}`);
      const data = await response.json();
      console.log('Recently Played Songs API Response:', data);

      const recentlyPlayedWithDetails = await Promise.all((data.recentlyPlayed || []).map(async (song) => {
        try {
          // Search Saavn.dev for full song details
          const searchResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL}/search?q=${encodeURIComponent(song.name + ' ' + song.artist)}&limit=1`);
          const searchData = await searchResponse.json();
          if (searchData.data && searchData.data.results && searchData.data.results.length > 0) {
            const fullSongDetails = searchData.data.results[0];
            return {
              ...song, // Keep existing recently played data
              downloadUrl: fullSongDetails.downloadUrl, // Add downloadUrl
              image: fullSongDetails.image, // Add full image array
            };
          }
        } catch (searchError) {
          console.error('Error fetching full details for recently played song:', song.name, searchError);
        }
        return song; // Return original song if details cannot be fetched
      }));

      setSearchResults(recentlyPlayedWithDetails);
      setTotalResults(recentlyPlayedWithDetails.length);
      setStartOffset(0); // Always start from 0 for recently played
    } catch (error) {
      console.error('Error fetching recently played songs:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    console.log('useEffect for recently played songs is running.');
    if (currentUserId) {
      fetchRecentlyPlayedSongs();
    }
  }, [fetchRecentlyPlayedSongs, currentUserId]); // Add currentUserId to dependencies

  const fetchSearchResults = useCallback(async (query, currentOffset, limit) => { // Add limit parameter
    if (!query.trim()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Always request 10 results from the backend
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/search?q=${encodeURIComponent(query)}&offset=${currentOffset}&limit=${limit}`);
      const data = await response.json();

      const newResults = data.data && data.data.results ? data.data.results : [];
      const total = data.data && data.data.total ? data.data.total : 0;

      setSearchResults(prevResults => [...prevResults, ...newResults]);
      setTotalResults(total);
      setStartOffset(data.data && data.data.start ? data.data.start : 0);
      // setHasMore will be managed by pagination buttons
    } catch (error) {
      console.error('Error searching JioSaavn:', error);
    } finally {
      setLoading(false);
    }
  }, []); // No dependencies needed for useCallback here, as it's always fetching next 10

  const handleSearch = () => {
    setCurrentPage(1); // Reset to first page
    setSearchResults([]); // Clear previous results
    fetchSearchResults(searchQuery, 0, 500); // Start with offset 0, fetch 500 results
  };

  const handlePlaySong = async (song) => {
    console.log('Attempting to play song:', song);
    console.log('Song URL:', song.url);
    if (audioRef.current) {
      let songUrl = '';
      if (song.downloadUrl && song.downloadUrl.length > 0) {
        // Try to get the highest quality (index 4)
        if (song.downloadUrl[4]?.url) {
          songUrl = song.downloadUrl[4].url;
        } else {
          // Fallback to the first available URL
          songUrl = song.downloadUrl[0].url;
        }
      }

      if (songUrl) {
        audioRef.current.src = songUrl;
        audioRef.current.play();
        setIsPlaying(true);
        setCurrentPlayingSong(song);
        setIsSongLoading(false); // Assuming it starts playing immediately
      } else {
        console.error('No playable song URL found for:', song);
        // Optionally, show an error message to the user
      }

      // Record the played song
      try {
        await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/music/record-played`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: currentUserId,
            songId: song.id,
            name: song.name,
            artist: song.artist ?? (song.artists?.primary?.[0]?.name ?? ''),
            imageUrl: song.image[2].url,
          }),
        });
        // After recording, re-fetch recently played songs to update the list
        fetchRecentlyPlayedSongs();
      } catch (error) {
        console.error('Error recording played song:', error);
      }
    }
  };

  const handleTogglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  useEffect(() => {
    if (audioRef.current) {
      const audio = audioRef.current;

      const updateProgress = () => {
        if (audio.duration) {
          setProgress((audio.currentTime / audio.duration) * 100);
          setCurrentTime(formatTime(audio.currentTime));
          setDuration(formatTime(audio.duration));
        }
      };

      const handleEnded = () => {
        setIsPlaying(false);
        setProgress(0);
        setCurrentTime('0:00');
        setDuration('0:00');
        setCurrentPlayingSong(null); // Clear current song
      };

      audio.addEventListener('timeupdate', updateProgress);
      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('play', () => setIsPlaying(true));
      audio.addEventListener('pause', () => setIsPlaying(false));
      audio.addEventListener('waiting', () => setIsSongLoading(true));
      audio.addEventListener('playing', () => setIsSongLoading(false));

      return () => {
        audio.removeEventListener('timeupdate', updateProgress);
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('play', () => setIsPlaying(true));
        audio.removeEventListener('pause', () => setIsPlaying(false));
        audio.removeEventListener('waiting', () => setIsSongLoading(true));
        audio.removeEventListener('playing', () => setIsSongLoading(false));
      };
    }
  }, []); // Empty dependency array to run once on mount

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]); // Dependencies: isOpen to add/remove listener, onClose to avoid stale closure

  // Debounce search query
  // useEffect(() => {
  //   setPage(0); // Reset page when search query changes
  //   setHasMore(true); // Assume more results initially
  //   const delayDebounceFn = setTimeout(() => {
  //     fetchSearchResults(searchQuery, 0);
  //   }, 500); // 500ms debounce time

  //   return () => clearTimeout(delayDebounceFn);
  // }, [searchQuery]);

  

  

  

  

  const getPaginatedResults = () => {
    const startIndex = (currentPage - 1) * 10;
    const endIndex = startIndex + 10;
    return searchResults.slice(startIndex, endIndex);
  };

  const handleSeek = (e) => {
    if (audioRef.current && audioRef.current.duration) {
      const progressBar = e.currentTarget;
      const clickX = e.clientX - progressBar.getBoundingClientRect().left;
      const width = progressBar.offsetWidth;
      const percent = clickX / width;
      audioRef.current.currentTime = audioRef.current.duration * percent;
    }
  };

  const truncateText = (text, numWords) => {
    const words = text.split(' ');
    if (words.length > numWords) {
      return words.slice(0, numWords).join(' ') + '...';
    }
    return text;
  };

  return (
    <div ref={sidebarRef} className={`sidebar-container ${isOpen ? 'open' : ''}`}>
      {currentPlayingSong && (
        <div
          className="music-background-overlay"
          style={{
            backgroundImage: `url(${currentPlayingSong.image[2]?.url || ''})`, // Using saavn.dev's image[2].url
          }}
        ></div>
      )}
      <div
        className="sidebar-header"
        style={{
          backgroundImage: currentPlayingSong
            ? `url(${currentPlayingSong.image[2]?.url || ''})` // Using saavn.dev's image[2].url
            : undefined, // Let CSS handle default background
        }}
      >
        {currentPlayingSong ? (
          <div className="music-player-info">
            <h4>{truncateText(currentPlayingSong.name ?? '', 7)}</h4>
            <p>{truncateText(currentPlayingSong.artist ?? (currentPlayingSong.artists?.primary?.[0]?.name ?? ''), 7)}</p>
            <div className="music-controls">
              {/* <button onClick={() => playerRef.current.previousVideo()}>⏮</button> */}
              <button onClick={handleTogglePlayPause}>{isPlaying ? '⏸' : '▶'}</button>
              {/* <button onClick={() => playerRef.current.nextVideo()}>⏭</button> */}
            </div>
            <div className="progress-bar-container" onClick={handleSeek}>
              <div className="progress-bar" style={{ width: `${progress}%` }}></div>
            </div>
            <div className="time-display">
              <span>{currentTime}</span>
              <span>{duration}</span>
            </div>
          </div>
        ) : (
          <h3>Music Player</h3>
        )}
        <button className="close-btn" onClick={onClose}>&times;</button>
      </div>
      <div className="sidebar-content">
        <div className="music-search-box">
          <input
            type="text"
            placeholder="Search music..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch}>Search</button>
        </div>
        <audio ref={audioRef} /> {/* Audio element for playback */}

        {searchQuery && searchResults.length > 0 && (
          <div className="search-summary">
            <p>Showing {getPaginatedResults().length} of {totalResults} results (Page {currentPage}).</p>
          </div>
        )}
        <ul className="search-results" ref={searchResultsRef}>
          {getPaginatedResults().length > 0 ? (
            getPaginatedResults().map((item, index) => {
              return (
              <li key={item.id} className="search-result-item">
                <img src={item.imageUrl || item.image[2].url} alt={item.name} /> {/* Use imageUrl for recently played, image[2].url for search */}
                <div className="result-info">
                  <h4>{truncateText(item.name ?? '', 5)}</h4>
                  <p>{truncateText(item.artist ?? (item.artists?.primary?.[0]?.name ?? ''), 5)}</p>
                  <button className="play-button" onClick={() => handlePlaySong(item)}>
                    {isSongLoading && currentPlayingSong && currentPlayingSong.id === item.id ? 'Loading...' : '▶'}
                  </button>
                </div>
              </li>
            )})
          ) : (
            <p>No results found. Try searching for something!</p>
          )}
          {loading && <p>Loading results...</p>}
        </ul>
        {searchQuery && searchResults.length > 0 && (
          <div className="pagination-controls">
            <button
              onClick={() => setCurrentPage(prevPage => prevPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <span>Page {currentPage}</span>
            <button
              onClick={() => {
                const nextOffset = currentPage * 10;
                if (nextOffset < totalResults && nextOffset >= searchResults.length) {
                  fetchSearchResults(searchQuery, nextOffset);
                }
                setCurrentPage(prevPage => prevPage + 1);
              }}
              disabled={currentPage * 10 >= totalResults && currentPage * 10 >= searchResults.length}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default MusicSidebar;