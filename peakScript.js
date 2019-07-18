(function () {
	"use strict";
	var sw, sh; // usabe screen width and height
	var mapCanvas; // canvas for on-screen graphics
	var mapLeft, mapTop; // top-left of map relative to screen
	var mapN = 53.3333; // north and west edges of map (degrees)
	var mapW = -2.0;
	var profilesCanvas; // canvas for track altitude & speed profiles
	var x, y, x0, y0; // horizontal and vertical coordinates/measurements
	var offset = {};
	var status; // location & trip data
	var json;
	var measuring=false;
	var enroute=false;
	var ready = false;
	var tracking = false;
	var trackNames=[];
	var listIndex=0;
	var trackpoints = []; // array of track objects - locations, altitudes, timestamps, lengths, durations,...
	var routeNames=[];
	var nodes=[]; // array of route node locations
	var metric=false;
    var geolocator = null;
	var loc={};
	var lastLoc = {};
	var fix;
	var fixes=[];
	var accuracy, dist, distance, heading, speed, hi, lo, climb, duration, moving; // fix & track data
	var deg = "&#176;";
	var compass="N  NNENE ENEE  ESESE SSES  SSWSW WSWW  WNWNW NNWN  ";
	var months="JanFebMarAprMayJunJulAugSepOctNovDec";
	var notifications=[];
	
	// console.log("variables initialised");
	// EVENT HANDLERS
	window.onresize=function(evt) {
		sh=window.innerHeight;
		console.log("window height: "+sh);
		id("mapScreen").style.height = sh+'px';
		id("mapCanvas").height = sh;
		redraw();
	}
	id("menuButton").addEventListener("click", function() {
		console.log("toggle menu");
		var display=id("menu").style.display;
		id("listPanel").style.display="none";
		id('profilesPanel').style.display='none';
		id("menu").style.display = (display=="block")?"none":"block";
		id('metric').checked=metric;
		console.log("open menu - metric is "+metric+" - checked is "+id('metric').checked);
	});
	id("tracks").addEventListener("click", listTracks);
	id('profiles').addEventListener('click', profiles);
	id('profilesPanel').addEventListener('click', function() {
		id('profilesPanel').style.display='none';
	});
	id("routes").addEventListener("click", listRoutes);
    id("measure").addEventListener("click",function() {
		measuring=true;
		distance=0;
		dist=0;
		climb=null;
		nodes=[];
		var node={};
		node.lon=loc.lon;
		node.lat=loc.lat;
		nodes.push(node);
		lastLoc.lon=loc.lon;
		lastLoc.lat=loc.lat;
		notify("measuring");
		id("stopButton").style.display="block";
		id("actionButton").style.display = "none";
		id("menu").style.display = "none";
	});
	id("metric").addEventListener("change", function() {
		metric=this.checked;
		window.localStorage.setItem('metric',metric);
		console.log("metric is "+metric);
		id("menu").style.display="none";
	});
	id('diagnostics').addEventListener('click', showNotifications);
	id("actionButton").addEventListener("click", getFix);
	id("stopButton").addEventListener("click", cease);
	// id("mapOverlay").addEventListener("click", moveTo);
	id("mapOverlay").addEventListener("touchstart", startMove);
	// id("mapOverlay").addEventListener("mousedown", startMove);
	id("mapOverlay").addEventListener("touchmove", move);
	// id("mapOverlay").addEventListener("mousemove", move);
	id('mapOverlay').addEventListener('touchend', endMove);
	id("saveButton").addEventListener("click", saver);
	id("cancelButton").addEventListener("click", function() {
	  id("saveDialog").style.display="none";
	  measuring=false;
	  nodes=[];
	});
	id('closeButton').addEventListener('click', function() {
	    id('listPanel').style.display='none';  
	});
	loc.lat = 53.2;
	loc.lon = -1.75;	// sw = window.innerWidth;	// sh = window.innerHeight;
	sw=window.innerWidth;
	sh=window.innerHeight;
	console.log("screen size: "+sw+"x"+sh);
	id("mapScreen").style.width = sw+'px';
	id("mapScreen").style.height = sh+'px';
	mapCanvas=id("mapCanvas").getContext("2d"); // set up drawing canvas
	id("mapCanvas").width = sw;
	id("mapCanvas").height = sh;
	profilesCanvas=id("profilesCanvas").getContext("2d"); // set up drawing canvas
	id("profilesCanvas").width=sw*0.9;
	id("profilesCanvas").height=sh*0.4;
	id("actionButton").style.display='block';
	for (x = 0; x < 3; x++) { // build map by positioning 10x10 grid of tiles
		for (var y = 0; y < 3; y++) {
			var tile=id("tile" + y + x);
			tile.style.left = (x * 720) +'px';
			tile.style.top = (y * 800) +'px';
		}
	}
	id("map").style.display='block';
	status = window.localStorage.getItem('peakLocation'); // recover last location
	console.log("location status: "+status);
	if(status) {
		json = JSON.parse(status);
		if((json.lat>=53)&&(json.lat<=53.3333)) loc.lat = json.lat;
		if((json.lon>=-2)&&(json.lon<=-1.5)) loc.lon = json.lon;
		if(loc.lon<-2) loc.lon=-2; // ensure within bounds of map
		if(loc.lon>-1.5) loc.lon=-1.5;
		if(loc.lat>53.3) loc.lat=53.3;
		if(loc.lat<53) loc.lat=53;
	}
	centreMap(); // go to saved location
    // ALWAYS START IN IMPERIAL UNITS
	// metric=window.localStorage.getItem("metric");
	id('metric').checked=metric;
	console.log("metric is "+metric+' - checked is '+id('metric').checked)
	// get list of saved tracks
	var json=JSON.parse(window.localStorage.getItem("peakTracks"));
	console.log("routes: "+json);
	if(json!=null) {
		trackNames=json.names;
		notify(trackNames.length+' tracks');
	}
	json=JSON.parse(window.localStorage.getItem("peakRoutes"));
	if(json!=null) {
		routeNames=json.names;
		notify(routeNames.length+' routes');
	}
	
	// LIST TRACKS
	function listTracks() {
		id("menu").style.display = "none";
		notify('list '+trackNames.length+' tracks');
		if(trackNames.length<1) return;
		id("listHeader").innerHTML="<b>Tracks</b>";
		// var trackList=document.createElement('ul');
		id('list').innerHTML='';
		for(var i=0; i<trackNames.length; i++) {
		    // notify('track '+i);
  			var listItem = document.createElement('li');
  			listItem.classList.add('listItem');
			var itemName = document.createElement('span');
			itemName.index=i;
			itemName.classList.add('itemName');
			itemName.innerHTML=trackNames[i];
			// notify('name: '+trackNames[i]);
			itemName.addEventListener('click', function(){listIndex=this.index; loadTrack();});
			var delButton = document.createElement('button');
			delButton.index=i;
			delButton.classList.add('deleteButton');
			delButton.addEventListener('click', function() {listIndex=this.index; deleteTrack();});
			// notify('delete button added for track '+i);
			listItem.appendChild(itemName);
			listItem.appendChild(delButton);
			// trackList.appendChild(listItem);
			id('list').appendChild(listItem);
  		}
		id("listPanel").style.display = "block";
		notify('track list populated with '+trackNames.length+' tracks');
	}
	
	// LIST ROUTES
	function listRoutes() {
		id("menu").style.display = "none";
		console.log('list '+routeNames.length+' routes');
		if(routeNames.length<1) return;
		id("listHeader").innerHTML="<b>Routes</b>";
		// var routeList=document.createElement('ul');
		id('list').innerHTML='';
		for(var i=0; i<routeNames.length; i++) {
  			var listItem = document.createElement('li');
  			listItem.classList.add('listItem');
			var itemName = document.createElement('span');
			itemName.index=i;
			itemName.classList.add('itemName');
			itemName.innerHTML = routeNames[i];
			itemName.addEventListener('click', function(){listIndex=this.index; loadRoute();});
			var delButton = document.createElement('button');
			delButton.index=i;
			delButton.classList.add('deleteButton');
			delButton.addEventListener('click', function() {listIndex=this.index; deleteRoute();});
			listItem.appendChild(itemName);
			listItem.appendChild(delButton);
			// routeList.appendChild(listItem);
			id('list').appendChild(listItem);
  		}
		id("listPanel").style.display = "block";
	}
	
	// DRAG MAP
	function startMove(event) {
		var touches=event.changedTouches;
		x0=touches[0].clientX;
		y0=touches[0].clientY;
		// notify("start drag");
		id('listPanel').style.display='none';
		id('menu').style.display='none';
	}
	
	function move(event) {
		id('menu').style.display='none';
		var touches=event.changedTouches;
		x=touches[0].clientX;
		y=touches[0].clientY;
		// notify("drag by "+x+"x"+y+"px");
		loc.lon-=(x-x0)/14400;
		loc.lat+=(y-y0)/24000;
		x0=x;
		y0=y;
		centreMap();
	}
	
	function endMove(event) {
	    notify('end drag');
	    var touches=event.changedTouches;
	    x0=touches[0].clientX;
		y0=touches[0].clientY;
		notify('end at '+x0+','+y0+' measuring: '+measuring);
		if(measuring) {
			var node={};
			node.lon=loc.lon;
			node.lat=loc.lat;
			nodes.push(node);
			distance+=measure('distance',lastLoc.lon,lastLoc.lat,loc.lon,loc.lat);
			console.log('distance: '+distance+"m");
			lastLoc.lon=loc.lon;
			lastLoc.lat=loc.lat;
			centreMap();
		}
	}
	
	// ADD TRACKPOINT
	function addTP() {
		notify("trackpoint "+trackpoints.length+" alt:"+loc.alt);
		var tp={};
		tp.lon=loc.lon;
		tp.lat=loc.lat;
		tp.alt=loc.alt;
		tp.time=loc.time;
		trackpoints.push(tp);
		if(trackpoints.length<2) return;
		if(trackpoints.length>4) id('profiles').style.color='white';
		redraw();
	}
	
	// LOCATION FIX
	function getFix() { // get fix on current location
		if(navigator.geolocation) {
			var opt={enableHighAccuracy: true, timeout: 15000, maximumAge: 0};
			navigator.geolocation.getCurrentPosition(gotoFix,locationError,opt);
		}
	}
	
	function gotoFix(position) {
		console.log("gotoFix");
		loc.lon=position.coords.longitude;
		loc.lat=position.coords.latitude;
		loc.alt=position.coords.altitude;
		if(loc.alt!=null) loc.alt=Math.round(loc.alt);
		notify("fix at "+loc.lon+","+loc.lat+","+loc.alt);
		centreMap();
		id("actionButton").innerHTML='<img src="goButton24px.svg"/>';
		id("actionButton").removeEventListener("click", getFix);
		id("actionButton").addEventListener("click", go);
		ready=true;
		window.setTimeout(timeUp,15000); // revert to fix button after 15 secs
	}
	
	function timeUp() {
		if(tracking) return;
		console.log("times up - back to fix button");
		id("actionButton").innerHTML='<img src="fixButton24px.svg"/>';
		id("actionButton").removeEventListener("click", go);
		id("actionButton").addEventListener("click", getFix);
		ready=false;
	}
	
	// START TRACKING
	function go() { // start tracking location
		ready=false;
		tracking = true;
		trackpoints = [];
		loc = {};
		lastLoc = {};
		distance = 0;
		duration=moving=0;
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
		id("actionButton").innerHTML='<img src="pauseButton24px.svg"/>';
		id("actionButton").removeEventListener("click", go);
		id("actionButton").addEventListener("click", stopStart);
		id("measure").style.display='none';
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
		id("stopButton").style.display="block";
		id("actionButton").innerHTML='<img src="goButton24px.svg"/>';
	}
	
	function resume() { // restart tracking after pausing
		console.log("RESUME");
		id("stopButton").style.display="none";
		id("actionButton").innerHTML='<img src="pauseButton24px.svg"/>';
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
		if(trackpoints.length<1) { // at start, initialise lastLoc and...
			addTP(); // ...add first trackpoint
		}
		else {
			dist = measure("distance",loc.lon,loc.lat,lastLoc.lon,lastLoc.lat); // distance since last averaged fix
			// notify('moved '+Math.round(dist)+"m");
			if((loc.time-lastLoc.time)>60) { // resample 3 readings after waking up
				lastLoc.time=loc.time;
				fix=0;
				return;
			}
			else if(dist>3) { // if moving adjust distance, duration, speed, heading
				moving+=(loc.time-lastLoc.time);
				var t=trackpoints.length-1; // most recent trackpoint
				dist=measure("distance",loc.lon,loc.lat,trackpoints[t].lon,trackpoints[t].lat); // distance since last trackpoint
				var interval=loc.time-trackpoints[t].time;
				if(dist>0) speed=dist/interval; // current speed m/s
				var direction=measure("heading",trackpoints[t].lon,trackpoints[t].lat,loc.lon,loc.lat); // heading since last trackpoint
				var turn=Math.abs(direction-heading);
				if(turn>180) turn=360-turn;
				// notify('dist: '+dist+' moving:'+moving+' direction:'+direction);
				lastLoc.lon = loc.lon;	duration=loc.time-trackpoints[0].time;
			}
			else speed=0;
		}
		lastLoc.time = loc.time;
		lastLoc.lon=loc.lon;
		lastLoc.lat = loc.lat;
		if(trackpoints.length>1) { // ignore first fixes - inaccurate?
			if((hi==0)||((lo-loc.alt)>5)) { // start altitude logging or new low
				hi=lo=loc.alt; // reset lo and hi at second trackpoint or new lo-point
				notify("new lo (and hi):"+hi);
			}
			else if((loc.alt-hi)>5) { // climbing
				lo = hi;
				hi = loc.alt; // climbing - set new hi-point
				climb += (hi-lo); // increment total climbed
				notify("climbing - new hi:"+hi);
			}
			else if((hi - loc.alt) > 5) { // going over the top
				hi = lo = loc.alt; // reset hi & lo until climbing again
				notify("OTT - new hi & lo:"+hi);
			}
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
	
	// STOP TRACKING
	function cease(event) {
		notify("CEASE: tracking is "+tracking+"; measuring is "+measuring+"; "+trackpoints.length+" trackpoints");
		if(tracking) {
			navigator.geolocation.clearWatch(geolocator);
			id("actionButton").innerHTML='<img src="fixButton24px.svg"/>';
			id("actionButton").removeEventListener("click", stopStart);
			id("actionButton").addEventListener("click", getFix);
		}
		id("stopButton").style.display="none";
		id("measure").style.display="block";
		redraw();
		if(nodes.length>5) { // offer to save route
			notify("save route?");
			id('saveName').value="";
			id("saveDialog").style.display = "block";
		}
		if(trackpoints.length>5) { // offer to save track
			name='';
			var now = new Date();
			var name = now.getYear()%100 + months.substr(now.getMonth()*3,3) + now.getDate() + '.'; // YYmonDD
			var t =now.getHours();
			if(t<10) name+="0";
			name+=(t+":");
			t=now.getMinutes();
			if(t<10) name+="0";
			name+=t; // YYmonDD.HH:MM
			notify("track name: "+name);
			id("saveName").value=name;
			id("saveDialog").style.display = "block";
		}
	}

    // REDRAW MAP OVERLAY
	function redraw() {
		var i, p, x, y, r, d, t;
		// notify("redraw - tracking is "+tracking);
		mapCanvas.clearRect(0,0,sw,sh);
		mapCanvas.lineWidth=5;
		var gradient=mapCanvas.createLinearGradient(0,0,0,100);
		gradient.addColorStop(0,'#333333');
		gradient.addColorStop(1,'#33333300');
		mapCanvas.fillStyle=gradient;
		mapCanvas.fillRect(0,0,sw,100);
		mapCanvas.fill();
		mapCanvas.textBaseline='top';
		mapCanvas.textAlign='left';
		mapCanvas.fillStyle = 'white';
		mapCanvas.font = '16px Sans-Serif';
		var string=dm(loc.lat, true);
		mapCanvas.fillText(string,45,5);
		string=dm(loc.lon, false);
		mapCanvas.fillText(string,45,25);
		mapCanvas.textAlign='right';
		if(loc.alt!=null) {
			string=(metric)?loc.alt+"m":Math.round(3.281*loc.alt)+"ft";
			mapCanvas.fillText(string,sw/2,5);
		}
		// draw current route as green line
		mapCanvas.beginPath();
	    mapCanvas.strokeStyle = 'rgba(0,255,0,0.5)';
	    if(nodes.length>1) {
			// notify("draw route - "+nodes.length+" nodes");
	    	p=nodes[0];
	    	// x = (p.lon - loc.lon) * 14400 + sw / 2;
	    	// x=mapLeft-(mapW-p.lon)*14400;
	    	x=sw/2+(p.lon-loc.lon)*14400;
	    	// y = (loc.lat - p.lat) * 24000 + sh / 2;
	    	// y=mapTop-(p.lat-mapN)*24000;
	    	y=sh/2+(loc.lat-p.lat)*24000;
	    	mapCanvas.moveTo(x, y);
	    	for(i=1;i<nodes.length;i++) {
	    		p=nodes[i];
	       		// x = (p.lon - loc.lon) * 14400 + sw / 2;
	       		// x=mapLeft-(mapW-p.lon)*14400;
	       		x=sw/2+(p.lon-loc.lon)*14400;
	       		// y = (loc.lat - p.lat) * 24000 + sh / 2;
	       		// y=mapTop-(p.lat-mapN)*24000;
	       		y=sh/2+(loc.lat-p.lat)*24000;
	       		mapCanvas.lineTo(x, y);
	    	}
	    	mapCanvas.stroke();
		}
		// draw current track as blue line
		mapCanvas.beginPath();
		mapCanvas.strokeStyle = 'rgba(0,0,255,0.5)';
	    if(trackpoints.length>1) {
			// notify("draw track - "+trackpoints.length+" trackpoints");
	    	p=trackpoints[0];
	    	// x=mapLeft-(mapW-p.lon)*14400;
	    	x=sw/2+(p.lon-loc.lon)*14400;
	    	// y=mapTop-(p.lat-mapN)*24000;
	    	y=sh/2+(loc.lat-p.lat)*24000;
	    	mapCanvas.moveTo(x, y);
	    	for(i=1;i<trackpoints.length;i++) {
	    		p=trackpoints[i];
	       		// x=mapLeft-(mapW-p.lon)*14400;
	       		x=sw/2+(p.lon-loc.lon)*14400;
	       		// y=mapTop-(p.lat-mapN)*24000;
	       		y=sh/2+(loc.lat-p.lat)*24000;
	       		mapCanvas.lineTo(x, y);
	    	}
			if(tracking) mapCanvas.lineTo(sw/2,sh/2);
		}
		mapCanvas.rect(sw/2-8,sh/2-8,16,16);	 // blue square at current location
		mapCanvas.stroke();
		// display distance and time travelled and height climbed so far
		if(distance>0) {
			mapCanvas.font='Bold 16px Sans-Serif';
			// mapCanvas.textAlign = 'left';
			d=distance+dist;
			if(metric) { // metric units
				d=Math.round(d);
				if(d<1000) mapCanvas.fillText('m',0.75*sw,35);
				else {
					mapCanvas.fillText('km',0.75*sw,35);
					d=decimal(d/1000);
				}
			}
			else { // miles & yards
				d=Math.round(d*1.093613); // nearest yard to latest trackpoint
				if(d<1760) mapCanvas.fillText('yds',0.75*sw,35);
				else {
					mapCanvas.fillText('miles',0.75*sw,35);
					d=decimal(d/1760);
				}
			}
			// draw duration if tracking or track loaded
			if((duration>0)&&(trackpoints.length>0)) {
			// if(tracking && trackpoints.length>0) {
				mapCanvas.textAlign='right';
				t=Math.floor(moving/60);
				mapCanvas.font='Bold 24px Sans-Serif';
				var text=Math.floor(t/60)+":";
				t%=60;
				if(t<10) text+="0";
				text+=t;
				mapCanvas.fillText(text, sw-10, 5);
				text="+";
				t=Math.floor((duration-moving)/60);
				text+=(Math.floor(t/60)+":");
				t%=60;
				if(t<10) text+= "0";
				text+=t;
				mapCanvas.fillText(text, sw-10, 30);
			}
			mapCanvas.font = 'Bold 36px Sans-Serif';
			mapCanvas.fillText(d,0.75*sw,2);
			mapCanvas.font = 'Bold 16px Sans-Serif';
			mapCanvas.textAlign='right';
			if(climb!=null) mapCanvas.fillText("/ "+Math.round((metric)?climb:climb*3.281),sw/2,25);
		}
		if(distance>0) {
			gradient=mapCanvas.createLinearGradient(0,sh-150,0,sh);
			gradient.addColorStop(0,'#00000000');
			gradient.addColorStop(1,'black');
			mapCanvas.fillStyle = gradient;
			mapCanvas.fillRect(0,sh-150,sw,sh);
			mapCanvas.fillStyle='white';
			mapCanvas.textBaseline='alphabetic';
			mapCanvas.textAlign='left';
			// mapCanvas.font='Bold 36px Sans-Serif';
			if(tracking && speed>0) { // show current speed and direction
				mapCanvas.font='Bold 36px Sans-Serif';
				d=Math.round((heading+11.25)/22.5); // 16 compass directions: N, NNE, NE,...
				d=compass.substr(d*3,3)+" "; // compass point eg. NNE
			}
			else if(moving>0) { // show average speed
				mapCanvas.font='24px Sans-Serif';
				d='average ';
				speed=distance/moving; // m/s
			}
			d+=Math.round(((metric)?3.6:2.237)*speed);
			notify('d: '+d);
			d+=(metric)?"kph":"mph";
			mapCanvas.fillText(d,10,sh-10);
		}
	}
	
	// POSITION MAP
	function centreMap() { // move map to current location
		// notify("centre map at N"+loc.lat+" E"+loc.lon);
		var i, x, y;
		// new code for 3x3 tiles
		var row=Math.floor((mapN-loc.lat)*30); // centre tile
		var col=Math.floor((loc.lon-mapW)*20);
		row--; // top/left tile of 3x3 grid
		col--;
		// notify("row "+row+"; col "+col);
		for(x=0;x<3;x++) { // populate 3x3 tile grid
			for(y=0;y<3;y++) {
				if(((row+y)<0)||((row+y>9))||((col+x)<0)||((col+x)>9))
					id("img"+y+x).src="tiles/blank.jpg";
				else id("img"+y+x).src="tiles/"+(row+y)+(col+x)+".jpg";
			}
		}
		var N=mapN-row/30;
		var W=mapW+col/20;
		// notify("N: "+N+"; W:"+W);
		mapLeft=(W-loc.lon)*14400+sw/2;
		mapTop=(loc.lat-N)*24000+sh/2;
		console.log("map position: "+mapLeft+", "+mapTop);
		var map=id("map");
		map.style.left = mapLeft+"px";
		map.style.top = mapTop+"px";
		redraw();
		json=JSON.stringify(loc);
		window.localStorage.setItem('peakLocation', json);
	}
	
	// SHOW TRACK PROFILES
	function profiles() {
		notify('show track profiles?');
		id("menu").style.display = "none";
		if(trackpoints.length<5) return;
		var n=trackpoints.length;
		// draw altitude and speed profiles
		var w=sw*0.9;
		var h=sh*0.25; // was 0.4;
		var maxAlt=0;
		var maxSpeed=0;
		notify(n+" trackpoints");
		// first create dark background
		profilesCanvas.fillStyle='#000000cc';
		profilesCanvas.clearRect(0,0,w,h);
		profilesCanvas.fillRect(0,0,w,h);
		// speed profile
		profilesCanvas.beginPath();
 	    profilesCanvas.strokeStyle = 'silver'; // speed profile is silver
		var x=0; // horizontal position
		var t=0; // time (sec)
		var s=0; // speed (km/hr)
		for (i=1;i<n;i++) { // for each trackpoint
			d=measure('distance',trackpoints[i-1].lon,trackpoints[i-1].lat,trackpoints[i].lon,trackpoints[i].lat);
			x+=d;
			t=trackpoints[i].time-trackpoints[i-1].time;
			s=3.6*d/t; // km/hr
			if(s>maxSpeed) maxSpeed=s;
			if(i%10==0) notify('trackpoint '+i+' d:'+Math.floor(d)+'m s:'+Math.floor(s)+"kph");
			if(i<1) profilesCanvas.moveTo(w*x/distance,h-h*s/200); // h=200kph
			else profilesCanvas.lineTo(w*x/distance,h-h*s/200);
			/*
			profilesCanvas.moveTo(w*x/distance,h);
			profilesCanvas.lineTo(w*x/distance,h-h*s/50); // h=50kph
			*/
		}
		profilesCanvas.stroke();
		
		// elevation profile
		profilesCanvas.beginPath();
		profilesCanvas.lineWidth=3;
	    profilesCanvas.strokeStyle = 'yellow'; // elevation profile is yellow
		notify('ready to draw elevation profile');
		var d=0;
		var t,x,y;
		for (var i=0;i<n;i++) {
			t=trackpoints[i];
			if(t.alt>maxAlt) maxAlt=t.alt;
			if(i>0) d+=measure('distance',t.lon,t.lat,trackpoints[i-1].lon,trackpoints[i-1].lat);
			// notify('i:'+i+' d:'+d);
			x=w*d/distance;
			y=h-h*t.alt*10/distance;
			// y=h*(maxAlt-t.alt)/dAlt;
			if(i<1) profilesCanvas.moveTo(x,y);
			else profilesCanvas.lineTo(x,y);
			// notify('line to '+x+','+y);
		}
		profilesCanvas.stroke();
		// draw grid km x 100m/10kph
		notify("draw grid");
		profilesCanvas.beginPath();
		x=0; // draw km intervals
		d=distance/1000; // km intervals
		d=w/d; // km as pixels
		profilesCanvas.lineWidth=1;
		profilesCanvas.strokeStyle = 'gray';
		while(x<w) { // km intervals
			x+=d;
			profilesCanvas.moveTo(x,0);
			profilesCanvas.lineTo(x,h);
		}
		for(i=1;i<5;i++) { // 100m/10kph intervals
			profilesCanvas.moveTo(0,i*h/5);
			profilesCanvas.lineTo(w,i*h/5);
		}
		profilesCanvas.stroke();
		// legend
		profilesCanvas.font='16px Sans-Serif';
		profilesCanvas.fillStyle='yellow';
		profilesCanvas.fillText('elevation - max: '+maxAlt+'m',10,20);
		profilesCanvas.fillStyle='silver';
		profilesCanvas.fillText('speed - max: '+Math.round(maxSpeed)+'kph',10,35);
		// draw close button
		profilesCanvas.strokeStyle='white';
		profilesCanvas.beginPath();
		profilesCanvas.moveTo(w-10,10);
		profilesCanvas.lineTo(w-30,30);
		profilesCanvas.moveTo(w-10,30);
		profilesCanvas.lineTo(w-30,10);
		profilesCanvas.stroke();
		notify("show profiles");
		id('profilesPanel').style.display='block';
		// id('doneButton').style.display='block';
	}
	
	// SAVE TRACK/ROUTE
	function saver() {
		var name=id("saveName").value;
		notify("save track/route as "+name);
		// DEAL WITH SAVING ROUTE
		if(measuring) { // save as route?
			if((routeNames.indexOf(name)>=0)||(trackNames.indexOf(name)>=0)) {
				alert(name+" already in use");
				return;
			}
			var route={};
			route.distance=distance;
			route.nodes=nodes;
			json=JSON.stringify(route);
			window.localStorage.setItem(name, json);
			routeNames.push(name);
			var routes={};
			routes.names=routeNames;
			notify("save routenames: "+routes.names);
			var json=JSON.stringify(routes);
			window.localStorage.setItem("peakRoutes",json);
			measuring=false;
			distance=0;
		}
		else { // save track?
			if(trackNames.indexOf(name)>=0) {
				alert(name+"already in use");
				return;
			}
			var track={};
			track.distance=distance;
			track.time=trackpoints[trackpoints.length-1].time-trackpoints[0].time;
			track.duration=duration;
			track.moving=moving;
			track.climb=climb;
			track.trackpoints=trackpoints;
			json=JSON.stringify(track);
			window.localStorage.setItem(name, json);
			trackNames.push(name);
			var tracks={};
			tracks.names=trackNames;
			notify("save tracknames: "+tracks.names);
			json=JSON.stringify(tracks);
			window.localStorage.setItem("peakTracks",json);
		}
		id("saveDialog").style.display="none";
	}
	
	// LOAD TRACK
	function loadTrack() {
		notify('load track '+listIndex+": "+trackNames[listIndex]);
		var json=window.localStorage.getItem(trackNames[listIndex]);
		var track=JSON.parse(json);
		distance=parseInt(track.distance);
		duration=parseInt(track.duration);
		moving=parseInt(track.moving);
		climb=parseInt(track.climb);
		trackpoints=track.trackpoints;
		dist=0;
		notify("load track with "+trackpoints.length+" trackpoints; length: "+distance+"m; duration: "+duration+"min; climb: "+climb+"m; "+moving+"minutes moving");
		id("listPanel").style.display='none';
		if(trackpoints.length>4) id('profiles').style.color='white';
		loc.lon=trackpoints[0].lon; // move to start of track
		loc.lat=trackpoints[0].lat;
		centreMap();
		redraw();
		profiles();
	}
	
	// DELETE TRACK
	function deleteTrack() {
		var name=trackNames[listIndex];
		alert('delete track '+listIndex+": "+name);
		trackNames.splice(listIndex,1);
		var tracks={};
		tracks.names=trackNames;
		var json=JSON.stringify(tracks);
		window.localStorage.setItem("peakTracks",json);
		window.localStorage.removeItem(name);
		notify(name+" deleted");
		id('listPanel').style.display='none';
	}
	
	// LOAD ROUTE
	function loadRoute() {
		notify('load route '+listIndex+": "+routeNames[listIndex]);
		var json=window.localStorage.getItem(routeNames[listIndex]);
		var route=JSON.parse(json);
		distance=parseInt(route.distance);
		nodes=route.nodes;
		dist=0;
		notify("load route with "+nodes.length+" nodes; length: "+distance+"m");
		id("listPanel").style.display='none';
		loc.lon=nodes[0].lon; // move to start of route
		loc.lat=nodes[0].lat;
		centreMap();
		redraw();
	}
	
	// DELETE ROUTE
	function deleteRoute() {
		var name=routeNames[listIndex];
		alert('delete route '+listIndex+": "+name);
		routeNames.splice(listIndex,1);
		var routes={};
		routes.names=routeNames;
		var json=JSON.stringify(routes);
		window.localStorage.setItem("peakRoutes",json);
		window.localStorage.removeItem(name);
		notify(name+" deleted");
		id('listPanel').style.display='none';
	}

    // UTILITY FUNCTIONS
	function dm(degrees, lat) {
	    var ddmm;
	    var negative = false;
	    var n;
	    if (degrees<0) {
	        negative=true;
	        degrees=degrees*-1;
	    }
	    if(negative) {
	    	if(lat) ddmm="S";
	        else ddmm="W";
	    }
	    else {
	    	if(lat) ddmm="N";
	    	else ddmm="E";
	    }
	    n=Math.floor(degrees); // whole degs
	    ddmm+=" "+n+":"; 
	    n=(degrees-n)*60; // minutes
	    // if(n<10) ddmm+="0";
	    ddmm+=decimal(n);
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
		while(notifications.length>25) notifications.shift();
		console.log(note);
	}
	
	function showNotifications() {
		var message="";
		for(var i in notifications) {
			message+=notifications[i]+"; ";
		}
		alert(message);
		id('menu').style.display='none';
	}
	
	function id(el) {
	    return document.getElementById(el);
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
