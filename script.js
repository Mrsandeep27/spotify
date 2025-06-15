console.log("wElcome to spofity");

// Intialize the value
let songindex = 0;
let audioELEMENT = new Audio("songs/1.mp3");
let masterplay = document.getElementById('masterplay');
let myprogressbar = document.getElementById('myprogressbar')
let gif = document.getElementById('gif');
let songitems = Array.from(document.getElementsByClassName('songitem'));

let song = [
    { songNAME: "PERFECT", filepath: "songs/1.mp3", coverpath: "covers/1.jpg" },
    { songNAME: "Shape of you", filepath: "songs/2.mp3", coverpath: "covers/2.jpg" },
    { songNAME: "Snap", filepath: "songs/3.mp3", coverpath: "covers/3.jpg" },
    { songNAME: "Ghumshudaa", filepath: "songs/4.mp3", coverpath: "covers/4.jpg" },
    { songNAME: "Jdugar", filepath: "songs/5.mp3", coverpath: "covers/5.jpg" },
    { songNAME: "Tum aakho se baatna ", filepath: "songs/6.mp3", coverpath: "covers/6.jpg" },
    { songNAME: "Tum sa hi ", filepath: "songs/7.mp3", coverpath: "covers/7.jpg" },
    { songNAME: "Tere liye duniya chod di hai", filepath: "songs/8.mp3", coverpath: "covers/8.jpg" },
    { songNAME: "Welcome to my drak side ", filepath: "songs/9.mp3", coverpath: "covers/9.jpg" },
    { songNAME: "Welcome to my drak side ", filepath: "songs/10.mp3", coverpath: "covers/10.jpg" },
]

songitems.forEach((element, i) => {
    element.getElementsByTagName("img")[0].src = song[i].coverpath;
    element.getElementsByClassName("songname")[0].innerText = song[i].songNAME;
});

// audioELEMENT.play();

// Handle play/pause button
masterplay.addEventListener('click', () => {
    if (audioELEMENT.paused || audioELEMENT.currentTime <= 0) {
        audioELEMENT.play();
        masterplay.classList.remove('fa-play-circle')
        masterplay.classList.add('fa-pause-circle')
        gif.style.opacity = 1;
    }
    else {
        audioELEMENT.pause();
        masterplay.classList.remove('fa-pause-circle')
        masterplay.classList.add('fa-play-circle')
        gif.style.opacity = 0;
    }
})

// Listen to the Event
audioELEMENT.addEventListener('timeupdate', () => {
    //    upadte seekbar
    progress = parseInt((audioELEMENT.currentTime / audioELEMENT.duration) * 100);
    myprogressbar.value = progress

})

myprogressbar.addEventListener('change', () => {
    audioELEMENT.currentTime = myprogressbar.value * audioELEMENT.duration / 100;
})

 Array.from(document.getElementsByClassName('songitemplay')).forEach((element)=>{
     element.addEventListener("click", (e)=>{
         console.log(e);
     })
})