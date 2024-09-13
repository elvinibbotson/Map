	"use strict";
	var sw, sh; // usable screen width and height
	var map; // CyclOSM map
	var profilesCanvas; // canvas for track altitude & speed profiles
	var x, y, x0, y0; // horizontal and vertical coordinates/measurements
	var offset = {};
	var json;
	var measuring=false;
	var enroute=false;
	var ready=false;
	var tracking=false;
	var trackNames=[];
	var listIndex=0;
	var track; // track polyline on map
	var trackpoints=[]; // array of track objects - locations, altitudes, timestamps, lengths, durations,...
	var routeNames=[];
	var nodes=[]; // array of route node locations
	var metric=true;
    var geolocator=null;
	var loc={};
	var zoom=10;
	var lastLoc={};
	var fix;
	var fixes=[];
	var lon, lat, dist, distance, heading, speed, duration, moving; // fix & track data
	var deg = "&#176;";
	var compass="N  NNENE ENEE  ESESE SSES  SSWSW WSWW  WNWNW NNWN  ";
	var months="JanFebMarAprMayJunJulAugSepOctNovDec";
	var notifications=[];
	
	// EVENT HANDLERS
	/* REVISE ALL THESE
	id("tracks").addEventListener("click", listTracks);
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
		show('stopButton',true);
		show('actionButton',false);
		show('menu',false);
	});
	id("metric").addEventListener("change", function() {
		metric=this.checked;
		window.localStorage.setItem('metric',metric);
		console.log("metric is "+metric);
		show('menu',false);
	});
	id('diagnostics').addEventListener('click', showNotifications);
	*/
	// OLD id('map').addEventListener('click',mapTap);
	id('plusButton').addEventListener('click',zoomIn);
	id('minusButton').addEventListener('click',zoomOut);
	id("actionButton").addEventListener("click", getFix);
	id("stopButton").addEventListener("click", cease);
	id("saveButton").addEventListener("click", saver);
	id('moreButton').addEventListener('click',function() {
		show('moreButton',false);
		id('more').style.display='block';
	});
	id('helpButton').addEventListener('click',showNotifications);
	id("cancelButton").addEventListener("click", function() {
	  show('saveDialog',false);
	  measuring=false;
	  nodes=[];
	});
	id('closeButton').addEventListener('click', function() {
	    show('listScreen',false);
	    trackpoints=[];
	    nodes=[];
	    show('actionButton',true);
	    redraw();
	});
	sw=window.innerWidth;
	sh=window.innerHeight;
	console.log("screen size: "+sw+"x"+sh);
	id('map').style.width=sw+'px';
	id('map').style.height=sh+'px';
	profilesCanvas=id("profilesCanvas").getContext("2d"); // set up drawing canvas
	id("profilesCanvas").width=sw;
	id("profilesCanvas").height=sh*0.2;
	id('locus').style.left=(sw/2-12)+'px';
	id('locus').style.top=(sh/2-12)+'px';
	show('map',true);
	show('locus',true);
	show('controls',false);
	show('plusButton',true);
	show('minusButton',true);
	show('actionButton',true);
	show('moreControls',false);
	show('moreButton',true);
	show('more',false);
	show('routeButton',true);
	show('routesButton',true);
	show('unitButton',true);
	show('helpButton',true);
	lat=window.localStorage.getItem('lat');
	lon=window.localStorage.getItem('lon');
	console.log('saved location: '+lon+','+lat);
	if(lon===null || lat===null) {
		lon=-1.75;
		lat=53.5;
	}
	loc.coords=[lat,lon]; // WAS L.LatLng(lat,lon); // NEW use LatLng format
	zoom=window.localStorage.getItem('zoom');
	console.log('saved zoom: '+zoom);
	if(zoom===null) zoom=10;
	map=L.map('map',{zoomControl: false}).setView([lat,lon],zoom); // default location in Derbyshire
	/* standard OSM
	L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    	maxZoom: 19,
    	attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
	}).addTo(map);
	*/
	// CyclOSM
	L.tileLayer('https://dev.c.tile.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', {
    	maxZoom: 20,
    	attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; CyclOSM'
	}).addTo(map);
	
	// TEST POLYLINE
	var testTrack
	var latlngs=[];
	
	map.on('moveend',saveLoc);
	map.on('zoom',saveZoom);
	map.on('click',mapTap); // NEW
	map.on('locationfound',function(e) {
		loc.coords=e.latlng;
		centreMap();
		console.log('centred at '+loc.coords+'; tracking is '+tracking);
		if(!tracking) return;
		loc.coords=e.latlng; // NEW replaces...
		loc.alt=Math.round(e.altitude);
		loc.time=e.timestamp;
		console.log('location is '+loc.coords+' altitude: '+loc.alt+' time: '+loc.time);
		speed=e.speed;
		if(trackpoints.length<1) {
			addTP(loc.coords); // ...add first trackpoint
			lastLoc.coords=loc.coords;
		}
		else {
			console.log('lastLoc: '+lastLoc.coords+'; fix at '+loc.coords);
			dist=Math.round(map.distance(loc.coords,lastLoc.coords));
			notify('fix - distance: '+dist+'m');
			if(dist>10) { // trackpoints every 10m INCREASE THIS?
				addTP(loc.coords);
				lastLoc.coords=loc.coords;
			}
		}
	});
	map.on('locationerror',onLocationError);
	function onLocationError(e) {
		alert(e.message);
	}
	// get list of saved tracks
	var json=JSON.parse(window.localStorage.getItem("saxtonTracks"));
	console.log("routes: "+json);
	if(json!=null) {
		trackNames=json.names;
		notify(trackNames.length+' tracks');
	}
	json=JSON.parse(window.localStorage.getItem("saxtonRoutes"));
	if(json!=null) {
		routeNames=json.names;
		notify(routeNames.length+' routes');
	}
	
	// SAVE LOCATION
	function saveLoc() {
		var location=map.getCenter();
		console.log('map location: '+location);
		lat=location.lat;
		lon=location.lng;
		window.localStorage.setItem('lat',lat);
		window.localStorage.setItem('lon',lon);
		console.log('location saved: '+lon+','+lat );
	}
	
	// SAVE ZOOM
	function saveZoom() {
		// locus.setRadius(500/(4^zoom));
		zoom=map.getZoom();
		console.log('save zoom: '+zoom);
		window.localStorage.setItem('zoom',zoom);
	}
	
	// TAP MAP
	function mapTap(e) {
		console.log('tap on map at '+e.latlng);
		console.log('layerPoint: '+e.layerPoint);
		console.log('containerPoint: '+e.containerPoint);
		
		// TEST POLYLINES
		latlngs.push(e.latlng);
		if(latlngs.length==2) {
			console.log('polyline: '+latlngs);
			testTrack=L.polyline(latlngs, {color: 'yellow'}).addTo(map);
		}
		if(latlngs.length>1) testTrack.setLatLngs(latlngs);
		
		if(id('controls').style.display=='block') {
			show('controls',false);
			show('moreControls',false);
			show('more',false);
		}
		else {
			show('controls',true);
			show('moreControls',true);
			show('moreButton',true);
		}
		
	}
	
	// ZOOM IN
	function zoomIn() {
		map.zoomIn();
		zoom=map.getZoom();
	}
	
	// ZOOM OUT
	function zoomOut() {
		map.zoomOut();
		zoom=map.getZoom();
	}
	
	// LIST TRACKS
	function listTracks() {
	    // show('menu',false);
		notify('list '+trackNames.length+' tracks');
		if(trackNames.length<1) return;
		id('list').innerHTML="<li class='listItem'><b>TRACKS</b></li>";
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
  		// id('list').innerHTML+='<li onclick="clear()">CLEAR</li>';
  		show('listScreen',true);
		notify('track list populated with '+trackNames.length+' tracks');
	}
	
	// LIST ROUTES
	function listRoutes() {
	    // show('menu',false);
		console.log('list '+routeNames.length+' routes');
		if(routeNames.length<1) return;
		id('list').innerHTML="<li class='listItem'><b>ROUTES</b></li>";
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
			id('list').appendChild(listItem);
  		}
  		// id('list').innerHTML+='<li onclick="clear()">CLEAR</li>';
		show('listScreen',true);
	}
	
	// ADD TRACKPOINT
	function addTP() {
		var tp={};
		tp.coords=loc.coords;
		tp.alt=loc.alt;
		notify('trackpoint '+trackpoints.length+' at '+tp.coords+' alt: '+tp.alt);
		tp.time=loc.time;
		trackpoints.push(tp);
		if(trackpoints.length<2) return;
		// NEW CODE
		if(trackpoints.length==2) { // on second trackpoint, start drawing track on map
			track=L.polyline([trackpoints[0].coords,trackpoints[1].coords],{color:'red'}).addTo(map);
			// track.setStyle({stroke: true, strokeWeight: 5, color: 'black', opacity: 0.5, fill: false});
		}
		else if(trackpoints.length>2) track.addLatLng(tp.coords);
		// OLD CODE redraw();
	}
	
	// LOCATION FIX
	function getFix() { // get fix on current location
	console.log('get a fix');
		map.locate({watch: false, setView: true, maxZoom: 20}); // Leaflet method replaces...
		/* OLD CODE
		if(navigator.geolocation) {
			console.log('get a fix');
			var opt={enableHighAccuracy: true, timeout: 15000, maximumAge: 0};
			navigator.geolocation.getCurrentPosition(gotoFix,locationError,opt);
		}
		*/
		id("actionButton").innerHTML='<img src="goButton24px.svg"/>';
		id("actionButton").removeEventListener("click", getFix);
		id("actionButton").addEventListener("click", go);
		ready=true;
		window.setTimeout(timeUp,15000); // revert to fix button after 15 secs
	}
	/*
	function gotoFix(position) {
		console.log("go to Fix");
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
	*/
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
		tracking=true;
		trackpoints=[];
		loc={};
		lastLoc={};
		distance=0;
		duration=moving=0;
		heading=0;
		speed=0;
		notify("start tracking");
		map.locate({watch:true, setView: true, maxZoom: 20})
		id("actionButton").innerHTML='<img src="pauseButton24px.svg"/>';
		id("actionButton").removeEventListener("click", go);
		id("actionButton").addEventListener("click", stopStart);
		// show('measure',false);
	}
	
	function stopStart() {
		notify("stopStart");
		if(tracking) pause();
		else resume();
	}
	
	function pause() { // pause location tracking
		notify("PAUSE");
		addTP(); // add trackpoint on pause
		tracking=false;
		map.stopLocate(); // NEW CODE
		show('stopButton',true);
		id("actionButton").innerHTML='<img src="goButton24px.svg"/>';
	}
	
	function resume() { // restart tracking after pausing
		notify("RESUME");
		show('stopButton',false);
		id("actionButton").innerHTML='<img src="pauseButton24px.svg"/>';
		tracking = true;
		map.locate({watch:true});
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
		notify("CEASE: tracking is "+tracking+" - "+trackpoints.length+" trackpoints");
		if(tracking) {
			map.stopLocate(); // NEW CODE replace...
			id("actionButton").innerHTML='<img src="fixButton24px.svg"/>';
			id("actionButton").removeEventListener("click", stopStart);
			id("actionButton").addEventListener("click", getFix);
		}
		show('stopButton',false);
		if(nodes.length>5) { // offer to save route
			notify("save route?");
			id('saveName').value="";
			show('saveDialog',true);
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
			show('saveDialog',true);
		}
	}

    /* REDRAW MAP OVERLAY
	function redraw() {
		var i, p, x, y, r, d, t;
		console.log("redraw - tracking is "+tracking);
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
			// string=(metric)?loc.alt+"m":Math.round(3.281*loc.alt)+"ft";
			// mapCanvas.fillText(string,sw/2,5);
			mapCanvas.fillText(loc.alt+"m",sw/2,5); // elevation in m
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
		}
		if(tracking && speed>0) { // show current speed and direction
			gradient=mapCanvas.createLinearGradient(0,sh-150,0,sh);
			gradient.addColorStop(0,'#00000000');
			gradient.addColorStop(1,'black');
			mapCanvas.fillStyle = gradient;
			mapCanvas.fillRect(0,sh-150,sw,sh);
			mapCanvas.fillStyle='white';
			mapCanvas.textBaseline='alphabetic';
			mapCanvas.textAlign='left';
			// mapCanvas.font='Bold 36px Sans-Serif';
			mapCanvas.font='Bold 36px Sans-Serif';
			d=Math.round((heading+11.25)/22.5); // 16 compass directions: N, NNE, NE,...
			d=compass.substr(d*3,3)+" "; // compass point eg. NNE
			d+=Math.round(((metric)?3.6:2.237)*speed);
			// notify('d: '+d);
			d+=(metric)?"kph":"mph";
			mapCanvas.fillText(d,10,sh-10);
		}
	}
	*/
	
	// POSITION MAP
	function centreMap() { // move map to current location
		// notify("centre map at N"+loc.lat+" E"+loc.lon);
		console.log('centreMap at '+loc.coords);
		map.setView(loc.coords);
		var i, x, y;
		// new code for 3x3 tiles
		/*
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
		*/
		// json=JSON.stringify(loc);
		// window.localStorage.setItem('saxtonLocation', json);
		saveLoc();
	}

	
	// SHOW TRACK PROFILES
	function profiles() {
		// notify('show track profiles?');
		// show('menu',false);
		if(trackpoints.length<5) return;
		var n=trackpoints.length;
		// draw altitude and speed profiles
		var w=sw;
		var h=sh*0.2; // was 0.4;
		var minAlt=1000;
		var maxAlt=0;
		var maxSpeed=0;
		var avSpeed=distance*3.6/moving; // kph
		notify('distance:'+distance+' moving:'+moving+' average speed:'+avSpeed+'kph');
		notify(n+" trackpoints");
		// first create dark background
		profilesCanvas.clearRect(0,0,w,h);
		var gradient=profilesCanvas.createLinearGradient(0,0,0,h);
		gradient.addColorStop(0,'#00000000');
		gradient.addColorStop(1,'black');
		profilesCanvas.fillStyle=gradient;
		profilesCanvas.fillRect(0,0,w,h);
		// speeds
		var t=0; // time (sec)
		var s=0; // compute maximium speed (km/hr)
		for (i=1;i<n;i++) { // for each trackpoint
			d=measure('distance',trackpoints[i-1].lon,trackpoints[i-1].lat,trackpoints[i].lon,trackpoints[i].lat);
			// x+=d;
			t=trackpoints[i].time-trackpoints[i-1].time;
			s=3.6*d/t; // km/hr
			if(s>maxSpeed) maxSpeed=s;
		}
		// elevation profile
		profilesCanvas.beginPath();
		profilesCanvas.lineWidth=3;
	    profilesCanvas.strokeStyle = 'yellow'; // elevation profile is yellow
		notify('ready to draw elevation profile');
		var d=0;
		var x,y;
		for (var i=0;i<n;i++) {
			t=trackpoints[i];
			if(t.alt<minAlt) minAlt=t.alt;
			if(t.alt>maxAlt) maxAlt=t.alt;
			if(i>0) d+=measure('distance',t.lon,t.lat,trackpoints[i-1].lon,trackpoints[i-1].lat);
			// notify('i:'+i+' d:'+d);
			x=w*d/distance;
			y=0.8*h-h*t.alt*20/distance;
			// y=h*(maxAlt-t.alt)/dAlt;
			if(i<1) profilesCanvas.moveTo(x,y);
			else profilesCanvas.lineTo(x,y);
			// notify('line to '+x+','+y);
		}
		profilesCanvas.stroke();
		// elevations and speeds
		profilesCanvas.font='16px Sans-Serif';
		profilesCanvas.textBaseline='alphabetic';
		profilesCanvas.fillStyle='white';
		maxSpeed=Math.round((metric)?maxSpeed:maxSpeed*0.62137);
		avSpeed=Math.round((metric)?avSpeed:avSpeed*0.62137);
		profilesCanvas.fillText(minAlt+'-'+maxAlt+'m ;'+maxSpeed+' max '+avSpeed+' average '+((metric)?'kph':'mph'),10,h-5);
		// notify("show profiles");
		show('profilesPanel',true);
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
			window.localStorage.setItem("saxtonRoutes",json);
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
			track.trackpoints=trackpoints;
			json=JSON.stringify(track);
			window.localStorage.setItem(name, json);
			trackNames.push(name);
			var tracks={};
			tracks.names=trackNames;
			notify("save tracknames: "+tracks.names);
			json=JSON.stringify(tracks);
			window.localStorage.setItem("saxtonTracks",json);
		}
		show('saveDialog',false);
	}
	
	// LOAD TRACK
	function loadTrack() {
		notify('load track '+listIndex+": "+trackNames[listIndex]);
		var json=window.localStorage.getItem(trackNames[listIndex]);
		var track=JSON.parse(json);
		distance=parseInt(track.distance);
		duration=parseInt(track.duration);
		moving=parseInt(track.moving);
		trackpoints=track.trackpoints;
		dist=0;
		notify("load track with "+trackpoints.length+" trackpoints; length: "+distance+"m; duration: "+duration+"sec; "+moving+"seconds moving");
		show('listScreen',false);
		loc.coords=trackpoints[0].coords; // NEW
		// loc.lon=trackpoints[0].lon; // move to start of track
		// loc.lat=trackpoints[0].lat;
		centreMap();
		// REPLACE WITH track POLYLINE redraw();
		show('actionButton',false);
		profiles();
	}
	
	// CLEAR TRACK/ROUTE
	function clear() {
	    notify('clear track/route');
	    trackpoints=[];
	    nodes=[];
	    show('actionButton',true);
	    redraw();
	}
	
	// DELETE TRACK
	function deleteTrack() {
		var name=trackNames[listIndex];
		alert('delete track '+listIndex+": "+name);
		trackNames.splice(listIndex,1);
		var tracks={};
		tracks.names=trackNames;
		var json=JSON.stringify(tracks);
		window.localStorage.setItem("saxtonTracks",json);
		window.localStorage.removeItem(name);
		notify(name+" deleted");
		show('listScreen',false);
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
		show('listScreen',false);
		loc.coords=nodes[0].coords; // NEW
		// loc.lon=nodes[0].lon; // move to start of route
		// loc.lat=nodes[0].lat;
		centreMap();
		// redraw();
	}
	
	// DELETE ROUTE
	function deleteRoute() {
		var name=routeNames[listIndex];
		alert('delete route '+listIndex+": "+name);
		routeNames.splice(listIndex,1);
		var routes={};
		routes.names=routeNames;
		var json=JSON.stringify(routes);
		window.localStorage.setItem("saxtonRoutes",json);
		window.localStorage.removeItem(name);
		notify(name+" deleted");
		show('listScreen',false);
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
	
	function show(element,visible) {
	    id(element).style.display=(visible)?'block':'none';
	}
	
	function notify(note) {
		notifications.push(note);
		while(notifications.length>50) notifications.shift();
		console.log(note);
	}
	
	function showNotifications() {
		var message="";
		for(var i in notifications) {
			message+=notifications[i]+"\n";
		}
		alert(message);
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
// })();
