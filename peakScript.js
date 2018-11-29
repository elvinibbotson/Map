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
	var measuring=false;
	var enroute=false;
	var ready = false;
	var tracking = false;
	var trackNames=[];
	var listIndex=0;
	var trackpoints = []; // array of track objects - locations, altitudes, timestamps, lengths, durations,...
	var routeNames=[];
	var nodes=[]; // array of route node locations
	var metric = false;
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
	document.getElementById("menuButton").addEventListener("click", function() {
		console.log("toggle menu");
		var display = document.getElementById("menu").style.display;
		document.getElementById("menu").style.display = (display=="block")?"none":"block";
		document.getElementById('metric').checked = metric;
	});
	document.getElementById("tracks").addEventListener("click", listTracks);
	document.getElementById("routes").addEventListener("click", listRoutes);
	document.getElementById("measure").addEventListener("click",function() {
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
		document.getElementById("stopButton").style.display="block";
		document.getElementById("actionButton").style.display = "none";
		document.getElementById("menu").style.display = "none";
	});
	document.getElementById("metric").addEventListener("change", function() {
		metric=this.checked;
		window.localStorage.setItem('metric', metric);
		console.log("metric is "+metric);
		document.getElementById("menu").style.display = "none";
	});
	document.getElementById('diagnostics').addEventListener('click', showNotifications);
	// document.getElementById("tracks").addEventListener("click", listTracks);
	document.getElementById("actionButton").addEventListener("click", getFix);
	document.getElementById("stopButton").addEventListener("click", cease);
	document.getElementById("mapOverlay").addEventListener("click", moveTo);
	// testing
	document.getElementById("mapOverlay").addEventListener("touchstart", startMove);
	document.getElementById("mapOverlay").addEventListener("mousedown", startMove);
	document.getElementById("mapOverlay").addEventListener("touchmove", move);
	document.getElementById("mapOverlay").addEventListener("mousemove", move);

	document.getElementById("saveButton").addEventListener("click", saver);
	document.getElementById("cancelButton").addEventListener("click", function() {
	  document.getElementById("saveDialog").style.display="none";
	  measuring=false;
	  nodes=[];
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
	document.getElementById("actionButton").style.top=(sh-120)+'px';
	document.getElementById("stopButton").style.left=(20)+'px';
	document.getElementById("stopButton").style.top=(sh-120)+'px';
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
		if((json.lat>=53)&&(json.lat<=53.3333)) loc.lat = json.lat;
		if((json.lon>=-2)&&(json.lon<=-1.5)) loc.lon = json.lon;
		if(loc.lon<-2) loc.lon=-2; // ensure within bounds of map
		if(loc.lon>-1.5) loc.lon=-1.5;
		if(loc.lat>53.3) loc.lat=53.3;
		if(loc.lat<53) loc.lat=53;
	}
	centreMap(); // go to saved location
	metric = window.localStorage.getItem("metric");
	document.getElementById('metric').checked = metric;
	// get list of saved tracks
	var json=JSON.parse(window.localStorage.getItem("wpTracks"));
	console.log("routes: "+json);
	if(json!=null) {
		trackNames = json.names;
		notify(trackNames.length+' tracks');
	}
	json=JSON.parse(window.localStorage.getItem("wpRoutes"));
	if(json!=null) {
		routeNames=json.names;
		notify(routeNames.length+' routes');
	}
	function listTracks() {
		document.getElementById("menu").style.display = "none";
		console.log('list '+trackNames.length+' tracks');
		if(trackNames.length<1) return;
		document.getElementById("list").innerHTML="<button id='closeListButton' class='menuButton'></button> TRACKS";
		var trackList=document.createElement('ul');
		for(var i=0; i<trackNames.length; i++) {
  			var listItem = document.createElement('li');
  			listItem.classList.add('listItem');
			var itemName = document.createElement('span');
			itemName.index=i;
			itemName.classList.add('itemName');
			itemName.innerHTML = trackNames[i];
			itemName.addEventListener('click', function(){listIndex=this.index; loadTrack();});
			var delButton = document.createElement('button');
			delButton.index=i;
			delButton.classList.add('deleteButton');
			delButton.addEventListener('click', function() {listIndex=this.index; deleteTrack();});
			listItem.appendChild(itemName);
			listItem.appendChild(delButton);
			trackList.appendChild(listItem);
  		}
  		document.getElementById('list').appendChild(trackList);
  		document.getElementById('closeListButton').addEventListener('click', function() {document.getElementById('list').style.display='none'});
		document.getElementById("list").style.display = "block";
	}
	function listRoutes() {
		document.getElementById("menu").style.display = "none";
		console.log('list '+routeNames.length+' routes');
		if(routeNames.length<1) return;
		document.getElementById("list").innerHTML="<button id='closeListButton' class='menuButton'></button> ROUTES";
		var routeList=document.createElement('ul');
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
			routeList.appendChild(listItem);
  		}
  		document.getElementById('list').appendChild(routeList);
  		document.getElementById('closeListButton').addEventListener('click', function() {document.getElementById('list').style.display='none'});
		document.getElementById("list").style.display = "block";
	}
	
	// test
	function startMove(event) {
		var touches=event.changedTouches;
		x0=touches[0].clientX;
		y0=touches[0].clientY;
		notify("start drag");
	}
	
	function move(event) {
		var touches=event.changedTouches;
		x=touches[0].clientX;
		y=touches[0].clientY;
		notify("drag by "+x+"x"+y+"px");
		loc.lon-=(x-x0)/14400;
		loc.lat+=(y-y0)/24000;
		x0=x;
		y0=y;
		centreMap();
	}

	function moveTo(event) {
		document.getElementById("menu").style.display = "none";
		x=sw/2-event.clientX;
		y=sh/2-event.clientY;
		console.log("move to "+x+", "+y+" from current position");
		loc.lat+=y/24000;
		loc.lon-=x/14400;
		if(measuring) {
			var node={};
			node.lon=loc.lon;
			node.lat=loc.lat;
			nodes.push(node);
			distance+=measure('distance',lastLoc.lon,lastLoc.lat,loc.lon,loc.lat);
			console.log('distance: '+distance+"m");
			lastLoc.lon=loc.lon;
			lastLoc.lat=loc.lat;
		}
		centreMap();
	}
	
	function addTP() {
		notify("add trackpoint "+trackpoints.length);
		var tp={};
		tp.lon=loc.lon;
		tp.lat=loc.lat;
		tp.alt=loc.alt;
		tp.time=loc.time;
		trackpoints.push(tp);
		redraw();
		if(trackpoints.length<2) return;
	}
	
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
		notify("fix at "+loc.lon+","+loc.lat);
		centreMap();
		document.getElementById("actionButton").innerHTML='<img src="goButton24px.svg"/>';
		document.getElementById("actionButton").removeEventListener("click", getFix);
		document.getElementById("actionButton").addEventListener("click", go);
		ready=true;
		window.setTimeout(timeUp,15000); // revert to fix button after 15 secs
	}
	
	function timeUp() {
		if(tracking) return;
		console.log("times up - back to fix button");
		document.getElementById("actionButton").innerHTML='<img src="fixButton24px.svg"/>';
		document.getElementById("actionButton").removeEventListener("click", go);
		document.getElementById("actionButton").addEventListener("click", getFix);
		ready=false;
	}
	
	function go() { // start tracking location
		ready=false;
		tracking = true;
		trackpoints = [];
		loc = {};
		lastLoc = {};
		distance = 0;
		duration = moving = 0;
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
		document.getElementById("measure").style.display='none';
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
		if(trackpoints.length<1) { // at start, initialise lastLoc and...
			// lastLoc.time = loc.time
			// lastLoc.lon = loc.lon;
			// lastLoc.lat = loc.lat;
			addTP(); // ...add first trackpoint
		}
		else {
			dist = measure("distance",loc.lon,loc.lat,lastLoc.lon,lastLoc.lat); // distance since last averaged fix
			notify('moved '+Math.round(dist)+"m");
			if(dist > 3) { // if moving adjust distance, duration, speed, heading
				moving += (loc.time - lastLoc.time);
				var t=trackpoints.length-1; // most recent trackpoint
				dist=measure("distance",loc.lon,loc.lat,trackpoints[t].lon,trackpoints[t].lat); // distance since last trackpoint
				var interval=loc.time-trackpoints[t].time;
				if(dist>0) speed=dist/interval; // current speed m/s
				var direction=measure("heading",trackpoints[t].lon,trackpoints[t].lat,loc.lon,loc.lat); // heading since last trackpoint
				var turn=Math.abs(direction-heading);
				if(turn>180) turn=360-turn;
				duration=loc.time-trackpoints[0].time;
			}
			else speed=0;
		}
		lastLoc.time = loc.time
		lastLoc.lon = loc.lon;
		lastLoc.lat = loc.lat;
		/*
		var t=track.length-1; // most recent trackpoint
		dist=measure("distance",loc.lon,loc.lat,track[t].lon,track[t].lat); // distance since last trackpoint
		var interval=loc.time-track[t].time;
		if(dist>0) speed = dist / interval; // current speed m/s
		var direction=measure("heading",track[t].lon,track[t].lat,loc.lon,loc.lat); // heading since last trackpoint
		var turn=Math.abs(direction-heading);
		if(turn>180) turn=360-turn;
		*/
		if((hi==0) || ((lo-loc.alt)>2)) {
			hi=lo=loc.alt; // reset lo and hi at first trackpoint or new lo-point
			notify("new lo (and hi)");
		}
		else if((loc.alt-hi)>5) {
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
		notify("CEASE: tracking is "+tracking+"; measuring is "+measuring+"; "+trackpoints.length+" trackpoints");
		if(tracking) {
			navigator.geolocation.clearWatch(geolocator);
			document.getElementById("actionButton").innerHTML='<img src="fixButton24px.svg"/>';
			document.getElementById("actionButton").removeEventListener("click", stopStart);
			document.getElementById("actionButton").addEventListener("click", getFix);
		}
		// navigator.geolocation.clearWatch(geolocator);
		document.getElementById("stopButton").style.display="none";
		document.getElementById("measure").style.display="block";
		// document.getElementById("actionButton").innerHTML='<img src="goButton24px.svg"/>';
		// document.getElementById("actionButton").removeEventListener("click", stopStart);
		// document.getElementById("actionButton").addEventListener("click", go);
		document.getElementById("heading").innerHTML = "Peak";
		redraw();
		if(nodes.length>5) { // offer to save route
			notify("save route?");
			document.getElementById('saveName').value="";
			document.getElementById("saveDialog").style.display = "block";
		}
		// IF MORE THAN 5 TRACKPOINTS, OFFER TO SAVE TO DATABASE USING DIALOG TO GIVE DEFAULT (EDITABLE) NAME 'YYMMDD-HH:MM'
		if(trackpoints.length>5) { // ************  CHANGE TO 5 **************
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
			document.getElementById("trackName").value = name;
			document.getElementById("saveDialog").style.display = "block";
		}
	}

	function redraw() {
	  var i, p, x, y, r, d, t;
	  notify("redraw - tracking is "+tracking);
	  mapCanvas.clearRect(0, 0, sw, sh);
		mapCanvas.lineWidth = 5;
		// mapCanvas.strokeStyle = 'rgba(0,0,255,0.5)';
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
			d=distance+dist;
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
			if(tracking && trackpoints.length>0) {
				mapCanvas.fillText('time (moving)', 100, 45);
				t=Math.floor(duration/60);
				mapCanvas.font = 'Bold 24px Sans-Serif';
				var text = Math.floor(t/60)+":";
				t%=60;
				if(t<10) text+="0";
				text+=t+" ("
				t=Math.floor(moving/60); // minutes not stopped
				text+=(Math.floor(t/60)+":");
				t%=60;
				if(t<10) text+= "0";
				text+=(t+")");
				mapCanvas.fillText(text, 100, 60);
			}
			mapCanvas.font = 'Bold 36px Sans-Serif';
			mapCanvas.fillText(d,5,57);
			mapCanvas.font = 'Bold 16px Sans-Serif';
			mapCanvas.textAlign = 'right';
			mapCanvas.fillText(((metric)?"m":"ft")+" climbed",sw-5,45);
			mapCanvas.font = 'Bold 36px Sans-Serif';
			if(climb!=null) mapCanvas.fillText(Math.round((metric)?climb:climb*3.281),sw-5,57);
		}
		if(tracking && speed>0) { // if tracking show current altitude with coordinates
			gradient=mapCanvas.createLinearGradient(0,sh-200,0,sh);
			gradient.addColorStop(0,'#00000000');
			gradient.addColorStop(1,'black');
			mapCanvas.fillStyle = gradient;
			mapCanvas.fillRect(0,sh-200,sw,sh);
			mapCanvas.fillStyle='white';
			mapCanvas.textBaseline='alphabetic';
			mapCanvas.textAlign='left';
			mapCanvas.font='Bold 60px Sans-Serif';
			mapCanvas.fillText(Math.round(((metric)?3.6:2.237)*speed), 5,sh-75);
			mapCanvas.font='Bold 16px Sans-Serif';
			mapCanvas.fillText((metric)?"kph":"mph", 5,sh-60);
			mapCanvas.font='Bold 36px Sans-Serif';
			d=Math.round((heading+11.25)/22.5); // 16 compass directions: N, NNE, NE,...
			d=compass.substr(d*3,3); // compass point eg. NNE
			mapCanvas.fillText(d,100,sh-75);
		}
		mapCanvas.beginPath(); // draw current track as blue line
	    mapCanvas.strokeStyle = 'rgba(0,255,0,0.5)';
	    if (nodes.length > 1) {
			notify("draw route - "+nodes.length+" nodes");
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
		mapCanvas.beginPath(); // draw current track as blue line
		mapCanvas.strokeStyle = 'rgba(0,0,255,0.5)';
	    if(trackpoints.length>1) {
			notify("draw track - "+trackpoints.length+" trackpoints");
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
	
	function saver() {
		var name = document.getElementById("saveName").value;
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
			window.localStorage.setItem("wpRoutes",json);
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
			var json=JSON.stringify(tracks);
			window.localStorage.setItem("wpTracks",json);
		}
		document.getElementById("saveDialog").style.display="none";
	}
	
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
		document.getElementById("list").style.display='none';
		loc.lon=trackpoints[0].lon; // move to start of track
		loc.lat=trackpoints[0].lat;
		centreMap();
		redraw();
		document.getElementById('list').style.display='none';
	}
	
	function deleteTrack() {
		var name=trackNames[listIndex];
		alert('delete track '+listIndex+": "+name);
		trackNames.splice(listIndex,1);
		var tracks={};
		tracks.names=trackNames;
		var json=JSON.stringify(tracks);
		window.localStorage.setItem("wpTracks",json);
		window.localStorage.removeItem(name);
		notify(name+" deleted");
		document.getElementById('list').style.display='none';
	}
	
	function loadRoute() {
		notify('load route '+listIndex+": "+routeNames[listIndex]);
		var json=window.localStorage.getItem(routeNames[listIndex]);
		var route=JSON.parse(json);
		distance=parseInt(route.distance);
		nodes=route.nodes;
		dist=0;
		notify("load track with "+nodes.length+" nodes; length: "+distance+"m");
		document.getElementById("list").style.display='none';
		loc.lon=nodes[0].lon; // move to start of route
		loc.lat=nodes[0].lat;
		centreMap();
		redraw();
		document.getElementById('list').style.display='none';
	}
	
	function deleteRoute() {
		var name=routeNames[listIndex];
		alert('delete route '+listIndex+": "+name);
		routeNames.splice(listIndex,1);
		var routes={};
		routes.names=routeNames;
		var json=JSON.stringify(routes);
		window.localStorage.setItem("wpRoutes",json);
		window.localStorage.removeItem(name);
		notify(name+" deleted");
		document.getElementById('list').style.display='none';
	}
	/*
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
	*/
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
		document.getElementById('menu').style.display='none';
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
