
(function () {
	"use strict";
	var sw, sh; // usabe screen width and height
	var mapCanvas; // canvas for on-screen graphics
	var mapLeft, mapTop; // top-left of map relative to screen
	var mapN = 53.3333; // north and west edges of map (degrees)
	var mapW = -2.0;
	var x, y, x0, y0; // horizontal and vertical coordinates/measurements
	var offset = {};
	var status; // location & trip data
	var json;
	var tracking = false;
	var metric = false;
    var geolocator = null;
	var loc={};
	var lastLoc = {};
	var fix;
	var fixes=[];
	var track = []; // array of track objects - locations, altitudes, timestamps, lengths, durations,...
	var accuracy, dist, distance, heading, speed, hi, lo, climb, time0, moving; // fix & track data
	var deg = "&#176;";
	var compass="N  NNENE ENEE  ESESE SSES  SSWSW WSWW  WNWNW NNWN  ";
	var months="JanFebMarAprMayJunJulAugSepOctNovDec";
	var notifications=[];
	
	// console.log("variables initialised");
	document.getElementById("menuButton").addEventListener("click", function() {
		console.log("toggle menu");
		var display = document.getElementById("menu").style.display;
		document.getElementById("menu").style.display = (display=="block")?"none":"block";
	});
	document.getElementById("metric").addEventListener("change", function() {
		metric=this.checked;
		window.localStorage.setItem('metric', metric);
		console.log("metric is "+metric);
		document.getElementById("menu").style.display = "none";
	});
	document.getElementById("tracks").addEventListener("click", listTracks);
	document.getElementById("actionButton").addEventListener("click", go);
	document.getElementById("stopButton").addEventListener("click", cease);
	document.getElementById("mapOverlay").addEventListener("click", moveTo);
	document.getElementById("saveButton").addEventListener("click", saveTrack);
	document.getElementById("cancelButton").addEventListener("click", function() {
	  document.getElementById("saveDialog").style.display="none";
	});
	loc.lat = 53.2;
	loc.lon = -1.75;
	// sw = window.innerWidth;
	// sh = window.innerHeight;
	sw=screen.width;
	sh=screen.height;
	console.log("window: "+sw+"x"+sh);
	document.getElementById("mapScreen").style.width = sw+'px';
	document.getElementById("mapScreen").style.height = sh+'px';
	mapCanvas = document.getElementById("mapCanvas").getContext("2d"); // set up drawing canvas
	document.getElementById("mapCanvas").width = sw;
	document.getElementById("mapCanvas").height = sh;
	document.getElementById("actionButton").style.left=(sw-70)+'px';
	document.getElementById("actionButton").style.top=(sh-70)+'px';
	document.getElementById("stopButton").style.left=(20)+'px';
	document.getElementById("stopButton").style.top=(sh-70)+'px';
	console.log("buttons moved!");
	document.getElementById("actionButton").style.display='block';
	for (x = 0; x < 3; x++) { // build map by positioning 10x10 grid of tiles
		for (var y = 0; y < 3; y++) {
			var tile = document.getElementById("tile" + y + x);
			tile.style.left = (x * 720) +'px';
			tile.style.top = (y * 800) +'px';
		}
	}
	document.getElementById("map").style.display = 'block';
	// console.log("mapCanvas size: "+document.getElementById("mapCanvas").width+"x"+document.getElementById("mapCanvas").height);
	status = window.localStorage.getItem('peakLocation'); // recover last location
	console.log("location status: "+status);
	if(status) {
		json = JSON.parse(status);
		if((json.lat>=53)&&(json.lat<=53.3333)) 	loc.lat = json.lat;
		if((json.lon>=-2)&&(json.lon<=-1.5)) loc.lon = json.lon;
	}
	centreMap(); // go to saved location
	metric = window.localStorage.getItem("metric");
	document.getElementById('metric').checked = metric;
	status = window.localStorage.getItem('peakTrip'); // recover previous trip stats
	// notify("trip status: "+status);
	if(status) {
		json=JSON.parse(status);
		var text="last trip distance: ";
		if(metric) text += decimal(json.distance/1000)+"km";
		else text += decimal(json.distance/1093.6)+"miles";
		text += " in ";
		if(json.time>60) text+=Math.floor(json.time/60)+" hr ";
		text+=json.time%60+" min (";
		if(json.moving>60) text+=Math.floor(json.moving/60)+"hr ";
		text+=json.moving%60+" min); speed: ";
		if(metric) text += Math.round(json.distance*60/1000/json.time)+"kph; ";
		else text += Math.round(json.distance*60/1093.6/json.time)+"mph; ";
		if(metric ) text += json.climb+" m climbed";
		else text += Math.round(json.climb*3.281)+"ft climbed";
		alert(text);
	}
	
	function listTracks() {
		document.getElementById("menu").style.display = "none";
		// alert("list saved tracks - can load or delete");
		// get list of saved tracks
		var tracks = window.localStorage.getItem("peakTracks");
		notify("tracks:" + tracks);
		if(!tracks) return;
		var names = JSON.parse(tracks).names;
		notify("first track: "+names[0]);
		document.getElementById("list").innerHTML=""; // clear list
		var html="";
		for(var i=0; i<names.length; i++) {
  			var listItem = document.createElement('li');
			listItem.index=i;
			html="<button class='deleteButton'>";
			html+=names[i]+"<br>";
			// html+="----X"; // JUST TESTING!!!
			listItem.innerHTML=html;
			document.getElementById('list').appendChild(listItem);
  		}
		alert("list: "+document.getElementById("list").innerHTML);
		document.getElementById("list").style.display = "block";
	}
	
	function moveTo(event) {
		document.getElementById("menu").style.display = "none";
		// alert("tap - tracking is "+tracking);
		if(tracking) {
			showNotifications(); // show testing diagnostics
			return;
		}
		x=sw/2-event.clientX;
		y=sh/2-event.clientY;
		console.log("move to "+x+", "+y+" from current position");
		loc.lat+=y/24000;
		loc.lon-=x/14400;
		centreMap();
	}
	
	function addTP() {
		notify("add trackpoint "+track.length);
		var tp={};
		tp.lon=loc.lon;
		tp.lat=loc.lat;
		tp.alt=loc.alt;
		tp.time=loc.time;
		track.push(tp);
		redraw();
		if(track.length<2) return;
		var trip={};
		trip.distance=decimal(distance+dist); // metres
		trip.time=Math.round((loc.time-track[0].time)/60); // minutes
		trip.moving=Math.round(moving/60); // minutes not stopped
		trip.climb=climb; // metres
		var json=JSON.stringify(trip);
		// console.log("save trip "+json);
		window.localStorage.setItem('peakTrip', json);
	}
	
	function go() { // start tracking location
		tracking = true;
		track = [];
		loc = {};
		lastLoc = {};
		distance = 0;
		time0 = moving = 0;
		heading = 0;
		speed = 0;
		hi = lo = climb = 0;
		notify("start tracking");
		fix=0;
		fixes=[];
	    if (navigator.geolocation) {
			var opt={enableHighAccuracy: true, timeout: 15000, maximumAge: 0};
        		geolocator = navigator.geolocation.watchPosition(sampleLocation, locationError, opt);
    		} else  {
       		alert("Geolocation is not supported by this browser.");
    		}
		document.getElementById("actionButton").innerHTML='<img src="pauseButton24px.svg"/>';
		document.getElementById("actionButton").removeEventListener("click", go);
		document.getElementById("actionButton").addEventListener("click", stopStart);
	}
	
	function stopStart() {
		console.log("stopStart");
		if(tracking) pause();
		else resume();
	}
	
	function pause() { // pause location tracking
		console.log("PAUSE");
		addTP(); // add trackpoint on pause
		tracking = false;
		navigator.geolocation.clearWatch(geolocator);
		document.getElementById("stopButton").style.display="block";
		document.getElementById("actionButton").innerHTML='<img src="goButton24px.svg"/>';
	}
	
	function resume() { // restart tracking after pausing
		console.log("RESUME");
		document.getElementById("stopButton").style.display="none";
		document.getElementById("actionButton").innerHTML='<img src="pauseButton24px.svg"/>';
		tracking = true;
		var opt={enableHighAccuracy: true, timeout: 15000, maximumAge: 0};
		geolocator = navigator.geolocation.watchPosition(sampleLocation, locationError, opt);
	}
	
	function sampleLocation(position) {
		var accuracy=position.coords.accuracy;
		// notify("fix "+fix+" accuracy: "+accuracy);
		if(accuracy>50) return; // skip inaccurate fixes
		fixes[fix]={};
		fixes[fix].lon=position.coords.longitude;
		fixes[fix].lat=position.coords.latitude;
		fixes[fix].alt=position.coords.altitude;
		fix++;
		if(fix<3) return;
		fix=0; // reset to get next three sample fixes
		var now=new Date();
		loc.time=Math.round(now.getTime()/1000); // whole seconds
		loc.lon=(fixes[0].lon+fixes[1].lon+fixes[2].lon)/3; // average location data
		loc.lat=(fixes[0].lat+fixes[1].lat+fixes[2].lat)/3;
		loc.alt=Math.round((fixes[0].alt+fixes[1].alt+fixes[2].alt)/3);
		// notify(loc.lon+","+loc.lat+", "+loc.alt+"m accuracy:"+accuracy);
		if(track.length<1) { // at start, initialise lastLoc and...
		  lastLoc.time = loc.time
		  lastLoc.lon = loc.lon;
		  lastLoc.lat = loc.lat;
			addTP(); // ...add first trackpoint
		}
		else {
			dist = measure("distance",loc.lon,loc.lat,lastLoc.lon,lastLoc.lat); // distance since last averaged fix
			notify('moved '+dist+"m");
			if(dist > 5) moving += (loc.time - lastLoc.time);
		}
		lastLoc.time = loc.time
		lastLoc.lon = loc.lon;
		lastLoc.lat = loc.lat;
		var t=track.length-1; // most recent trackpoint
		dist=measure("distance",loc.lon,loc.lat,track[t].lon,track[t].lat); // distance since last trackpoint
		var interval=loc.time-track[t].time;
		if(dist>0) speed = dist / interval; // current speed m/s
		var direction=measure("heading",track[t].lon,track[t].lat,loc.lon,loc.lat); // heading since last trackpoint
		var turn=Math.abs(direction-heading);
		if(turn>180) turn=360-turn;
		if((hi == 0) || ((lo - loc.alt) > 5)) {
			hi = lo = loc.alt; // reset lo and hi at first trackpoint or new lo-point
			notify("new lo (and hi)");
		}
		else if((loc.alt - hi) > 5) {
			lo = hi;
			hi = loc.alt; // climbing - set new hi-point
			climb += (hi-lo); // increment total climbed
			notify("climbing - new hi");
		}
		else if((hi - loc.alt) > 5) { // going over the top
			hi = lo = loc.alt; // reset hi & lo until climbing again
			notify("OTT - new hi & lo");
		}
		notify("lo:"+lo+" hi:"+hi+" climb:"+climb);
		if((dist>100)||(turn>30)) { // add trackpoint after 100m or when direction changes > 30*
			distance += dist;
			heading = Math.round(direction);
			addTP();
			dist = 0;
		}
		centreMap();
	}
	
	function locationError(error) {
		var message="";
		switch (error.code) {
			case error.PERMISSION_DENIED:
				message="location request denied";
				break;
			case error.POSITION_UNAVAILABLE:
				message="location not available";
				break;
			case error.TIMEOUT:
				message="location timeout";
				break;
			case error.UNKNOWN_ERROR:
				message="unknown loaction error";
		}
		alert(message);
	}
	
	function cease(event) {
		notify("CEASE tracking is "+tracking+"; "+track.length+" trackpoints");
		navigator.geolocation.clearWatch(geolocator);
		document.getElementById("stopButton").style.display="none";
		document.getElementById("actionButton").innerHTML='<img src="goButton24px.svg"/>';
		document.getElementById("actionButton").removeEventListener("click", stopStart);
		document.getElementById("actionButton").addEventListener("click", go);
		document.getElementById("heading").innerHTML = "White Peak";
		redraw();
		// IF TRACK HAS MORE THAN 5 TRACKPOINTS, OFFER TO SAVE TO DATABASE USING DIALOG TO GIVE DEFAULT (EDITABLE) NAME 'YYMMDD-HH:MM'
		if(track.length>1) { // ************  CHANGE TO 5 **************
			var now = new Date();
			var name = now.getYear()%100 + months.substr(now.getMonth()*3,3) + now.getDate() + '.'; // YYmonDD
			var t =now.getHours();
			if(t<10) name+="0";
			name+=(t+":");
			t=now.getMinutes();
			if(t<10) name+="0";
			name+=t; // YYmonDD.HH:MM
			notify("track name: "+name);
			document.getElementById("trackName").value = name;
			document.getElementById("saveDialog").style.display = "block";
		}
	}

	function redraw() {
	  var i, p, x, y, r, d, t;
	  notify("redraw - tracking is "+tracking);
	  mapCanvas.clearRect(0, 0, sw, sh);
		mapCanvas.lineWidth = 5;
		mapCanvas.strokeStyle = 'rgba(0,0,255,0.5)';
		mapCanvas.fillStyle = 'rgba(0,0,0,0.7)';
		mapCanvas.textBaseline = 'top';
		if(distance>0) { // display distance travelled and height climbed so far
			var gradient = mapCanvas.createLinearGradient(0,32,0,182);
			gradient.addColorStop(0,'black');
			gradient.addColorStop(1,'#00000000');
			mapCanvas.fillStyle = gradient;
			mapCanvas.fillRect(0,32,sw,182);
			mapCanvas.fill();
			mapCanvas.fillStyle = 'white';
			mapCanvas.font = 'Bold 16px Sans-Serif';
			mapCanvas.textAlign = 'left';
			d = distance+dist;
			if(metric) { // metric units
				d=Math.round(d);
				if(d<1000) mapCanvas.fillText('m',5,45);
				else {
					mapCanvas.fillText('km',5,45);
					d=decimal(d/1000);
				}
			}
			else { // miles & yards
				d=Math.round(d*1.093613); // nearest yard to latest trackpoint
				if(d<1760) mapCanvas.fillText('yds',5,45);
				else {
					mapCanvas.fillText('miles',5,45);
					d=decimal(d/1760);
				}
			}
			if(track.length>0) {
				mapCanvas.fillText('time (moving)', 100, 45);
				t=Math.floor((loc.time-track[0].time)/60); // total trip time (minutes)
				mapCanvas.font = 'Bold 24px Sans-Serif';
				var text = Math.floor(t/60)+":";
				t%=60;
				if(t<10) text += "0";
				text += t + " ("
				t = Math.floor(moving/60); // minutes not stopped
				text += (Math.floor(t/60)+":");
				t%=60;
				if(t<10) text += "0";
				text += (t +")");
				mapCanvas.fillText(text, 100, 60);
			}
			mapCanvas.font = 'Bold 36px Sans-Serif';
			mapCanvas.fillText(d,5,57);
			mapCanvas.font = 'Bold 16px Sans-Serif';
			mapCanvas.textAlign = 'right';
			mapCanvas.fillText(((metric)?"m":"ft")+" climbed",sw-5,45);
			mapCanvas.font = 'Bold 36px Sans-Serif';
			mapCanvas.fillText(Math.round((metric)?climb:climb*3.281),sw-5,57);
		}
		if(tracking && speed>0) { // if tracking show current altitude with coordinates
			gradient = mapCanvas.createLinearGradient(0,sh-150,0,sh);
			gradient.addColorStop(0,'#00000000');
			gradient.addColorStop(1,'black');
			mapCanvas.fillStyle = gradient;
			mapCanvas.fillRect(0,sh-150,sw,sh);
			mapCanvas.fillStyle = 'white';
			mapCanvas.textBaseline = 'alphabetic';
			mapCanvas.textAlign = 'left';
			mapCanvas.font = 'Bold 60px Sans-Serif';
			mapCanvas.fillText(Math.round(((metric)?3.6:2.237)*speed), 5,sh-20);
			mapCanvas.font = 'Bold 16px Sans-Serif';
			mapCanvas.fillText((metric)?"kph":"mph", 5,sh-5);
			mapCanvas.font = 'Bold 36px Sans-Serif';
			d=Math.round((heading+11.25)/22.5); // 16 compass directions: N, NNE, NE,...
			d=compass.substr(d*3,3); // compass point eg. NNE
			mapCanvas.fillText(d,100,sh-20);
		}
		mapCanvas.beginPath(); // draw current track as blue line
	    if (track.length > 1) {
			  notify("draw track - "+track.length+" trackpoints");
	    	p = track[0];
	    	// x = (p.lon - loc.lon) * 14400 + sw / 2;
	    	x=mapLeft-(mapW-p.lon)*14400;
	    	// y = (loc.lat - p.lat) * 24000 + sh / 2;
	    	y=mapTop-(p.lat-mapN)*24000;
	    	mapCanvas.moveTo(x, y);
	    	for (i = 1; i < track.length; i++) {
	    		p = track[i];
	       	// x = (p.lon - loc.lon) * 14400 + sw / 2;
	       	x=mapLeft-(mapW-p.lon)*14400;
	       	// y = (loc.lat - p.lat) * 24000 + sh / 2;
	       	y=mapTop-(p.lat-mapN)*24000;
	       	mapCanvas.lineTo(x, y);
	    	}
			if(tracking) mapCanvas.lineTo(sw/2,sh/2);
		}
		// console.log("draw box");
		mapCanvas.rect(sw / 2 - 8, sh / 2 - 8, 16, 16);	 // blue square at current location
		mapCanvas.stroke();
	}
	
	function centreMap() { // move map to current location
		notify("centre map at N"+loc.lat+" E"+loc.lon);
		var i, x, y;
		// new code for 3x3 tiles
		var row=Math.floor((mapN-loc.lat)*30); // centre tile
		var col=Math.floor((loc.lon-mapW)*20);
		row--; // top/left tile of 3x3 grid
		col--;
		notify("row "+row+"; col "+col);
		for(x=0;x<3;x++) { // populate 3x3 tile grid
			for(y=0;y<3;y++) {
				if(((row+y)<0)||((row+y>9))||((col+x)<0)||((col+x)>9))
					document.getElementById("img"+y+x).src="tiles/blank.jpg";
				else document.getElementById("img"+y+x).src="tiles/"+(row+y)+(col+x)+".jpg";
			}
		}
		var N=mapN-row/30;
		var W=mapW+col/20;
		notify("N: "+N+"; W:"+W);
		mapLeft=(W-loc.lon)*14400+sw/2;
		mapTop=(loc.lat-N)*24000+sh/2;
		console.log("map position: "+mapLeft+", "+mapTop);
		var map = document.getElementById("map");
		map.style.left = mapLeft+"px";
		map.style.top = mapTop+"px";
		var string = dm(loc.lat, true) + " " + dm(loc.lon, false) + " ";
		if(tracking) string += (metric)?loc.alt+"m":Math.round(3.281*loc.alt)+"ft";
		document.getElementById('heading').innerHTML = string;
		redraw();
		json=JSON.stringify(loc);
		window.localStorage.setItem('peakLocation', json);
	}
	
	function saveTrack() {
	  var name = document.getElementById("trackName").value;
	  var names=[];
	  notify("save track "+name);
		var tracks = window.localStorage.getItem("peakTracks");
		if(tracks) {
		  names = JSON.parse(tracks).names;
		  notify(names.length+" tracks already saved");
		  if((name.length<1)||(names.indexOf(name)>=0)) return;
		}
		json = JSON.stringify(track);
		window.localStorage.setItem(name, json);
		names.push(name);
		tracks={};
		tracks.names=names
		var json=JSON.stringify(tracks);
		window.localStorage.setItem("peakTracks",json);
		document.getElementById("saveDialog").style.display="none";
	}
	
	function dm(degrees, lat) {
	    var ddmm;
	    var negative = false;
	    var n;
	    if (degrees < 0) {
	        negative = true;
	        degrees = degrees * -1;
	    }
	    ddmm = Math.floor(degrees); // whole degs
	    n = (degrees - ddmm) * 60; // minutes
	    ddmm += deg;
	    if (n < 10) ddmm += "0";
	    ddmm += decimal(n) + "'";
	    if (negative) {
	        if (lat) ddmm += "S";
	        else ddmm += "W";
	    }
	    else {
	        if (lat) ddmm += "N";
	        else ddmm += "E";
	    }
	    return ddmm;
	}
	
	function measure(type,x0,y0,x,y) {
		var dx = x - x0;
	    var dy = y - y0;
        dx *= 66610; // allow for latitude
        dy *= 111111.111; // 90 deg = 10000 km
		if(type=="distance") return Math.sqrt(dx * dx + dy * dy);
		var h; // heading
		if (dy == 0) {
	        h = (dx > 0) ? 90 : 270;
	    }
	    else {
	        h = Math.atan(dx / dy) * 180 / Math.PI;
	        if (dy < 0) h += 180;
	        if (h < 0) h += 360 // range 0-360
        }
        return h;
	}
	
	function decimal(n) {
	    return Math.floor(n * 10 + 0.5) / 10;
	}
	
	function notify(note) {
		notifications.push(note);
		while(notifications.length>10) notifications.shift();
		console.log(note);
	}
	
	function showNotifications() {
		var message="";
		for(var i in notifications) {
			message+=notifications[i]+"; ";
		}
		alert(message);
	}

// implement service worker if browser is PWA friendly
	if (navigator.serviceWorker.controller) {
		console.log('Active service worker found, no need to register')
	} else { //Register the ServiceWorker
		navigator.serviceWorker.register('sw.js').then(function(reg) {
			console.log('Service worker has been registered for scope:'+ reg.scope);
		});
	}
})();
