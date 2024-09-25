	"use strict";
	var map; // CyclOSM map
	var profilesCanvas; // canvas for track altitude profiles
	var x, y, x0, y0; // horizontal and vertical coordinates/measurements
	var json;
	var routing=false;
	var enroute=false;
	var ready=false;
	var tracking=false;
	var trackNames=[];
	var listIndex=0;
	var track; // track polyline on map
	var trackpoints=[]; // array of track objects - locations, altitudes, timestamps, lengths, durations,...
	var routeNames=[];
	var nodes=[]; // array of route node locations
	var unit='km';
	var zoom=10;
	var loc={};
	var lastLoc={};
	var fix;
	var lng,lat,dist,distance; // fix & track data
	var deg = "&#176;";
	var compass="N  NNENE ENEE  ESESE SSES  SSWSW WSWW  WNWNW NNWN  ";
	var months="JanFebMarAprMayJunJulAugSepOctNovDec";
	var notifications=[];
	
	// EVENT HANDLERS
	id('plusButton').addEventListener('click',function(){
		map.zoomIn();
		zoom=map.getZoom();
		window.localStorage.setItem('zoom',zoom);
		console.log('zoom in to '+zoom);
	});
	id('minusButton').addEventListener('click',function(){
		map.zoomOut();
		zoom=map.getZoom();
		window.localStorage.setItem('zoom',zoom);
		console.log('zoom out to '+zoom);
	});
	id("actionButton").addEventListener("click",getFix);
	id("stopButton").addEventListener("click",cease);
	id("saveButton").addEventListener("click",saver);
	id('moreButton').addEventListener('click',function(){
		show('moreButton',false);
		id('more').style.display='block';
	});
	id('routeButton').addEventListener('click',function(){
		routing=true;
		distance=0;
		dist=0;
		lastLoc={};
		nodes=[];
		var node={};
		notify("routing");
		show('stopButton',false);
		show('actionButton',false);
		show('moreControls',false);
		// show('routeLength',true);
		show('dash',true);
		// show('duration',false);
		id('duration').innerText='route';
		show('speed',false);
		show('finish',true);
		if(track!==null) track.remove(); // remove any earlier route
	});
	id('finish').addEventListener('click',function(){
		notify("stop routing with "+nodes.length+" nodes");
		routing=false;
		show('duration',true);
		show('speed',true);
		show('dash',false);
		show('actionButton',true);
		if(nodes.length>5) { // offer to save route
			notify("save route?");
			id('saveName').value="";
			show('saveDialog',true);
		}
		else track.remove(); // do not retain routes <5 nodes
	})
	id('routesButton').addEventListener('click',listRoutes);
	id('closeButton').addEventListener('click',function(){
	    show('listScreen',false);
	    trackpoints=[];
	    nodes=[];
	    show('actionButton',true);
	    // redraw();
	});
	id('loadButton').addEventListener('click',loadRoute);
	// ADD EVENTS FOR renameButton, refineButton and removeButton
	id('unitButton').addEventListener('click',function(){
		if(unit=='km') unit='mi';
		else unit='km'; // toggle distance unit
		id('unitButton').innerText=unit;
		window.localStorage.setItem('unit',unit);
	});
	id('helpButton').addEventListener('click',showNotifications);
	id("cancelButton").addEventListener("click", function(){
	  show('saveDialog',false);
	  routing=false;
	  nodes=[];
	});
	
	var sw=window.innerWidth;
	var sh=window.innerHeight;
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
	lng=window.localStorage.getItem('lng');
	console.log('saved location: '+lng+','+lat);
	if(lng===null || lat===null) {
		lng=-1.75;
		lat=53.5;
	}
	loc.latlng=[lat,lng];
	zoom=window.localStorage.getItem('zoom');
	console.log('saved zoom: '+zoom);
	if(zoom===null) zoom=10;
	unit=window.localStorage.getItem('unit');
	console.log('unit: '+unit);
	id('unitButton').innerText=unit;
	map=L.map('map',{zoomControl: false}).setView([lat,lng],zoom); // default location in Derbyshire
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
	/* TEST POLYLINE
	var testTrack
	var latlngs=[];
	*/
	map.on('moveend',saveLoc);
	map.on('zoom',function(){
		zoom=map.getZoom();
		window.localStorage.setItem('zoom',zoom);
	});
	map.on('click',mapTap); // NEW
	map.on('locationfound',function(e) {
		loc.latlng=e.latlng;
		centreMap();
		console.log('centred at '+loc.latlng+'; tracking is '+tracking);
		loc.alt=Math.round(e.altitude);
		loc.time=e.timestamp;
		console.log('location is '+loc.latlng+' altitude: '+loc.alt+' time: '+loc.time);
		if(!tracking) return;
		if(trackpoints.length<1) {
			addTP(loc.latlng); // ...add first trackpoint
			lastLoc.latlng=loc.latlng;
		}
		else {
			console.log('lastLoc: '+lastLoc.latlng+'; fix at '+loc.latlng);
			dist=Math.round(map.distance(loc.latlng,lastLoc.latlng));
			notify('fix - distance: '+dist+'m');
			if(dist>10) { // trackpoints every 10m INCREASE THIS?
				addTP(loc.latlng);
				lastLoc.latlng=loc.latlng;
				distance+=dist;
			}
			var txt='';
			var duration=Math.floor(loc.time-trackpoints[0].time)/60000; // minutes
			txt=Math.floor(duration/60)+':'; // HH:
			console.log('hours: '+txt);
			duration%=60; // minutes
			duration=Math.floor(duration);
			if(duration<10) txt+='0';
			txt+=duration; // HH:MM
			console.log('duration: '+txt);
			id('duration').innerText=txt;
			dist=distance/1000; // km 
			if(unit=='mi') dist*=0.621371192; // miles
			console.log('distance: '+dist);
			txt=Math.floor(dist*10)/10;
			if(unit=='km') txt+=' kph';
			else txt+=' mph';
			id('distance').innerText=txt; // 1 decimal
			var speed=e.speed*3.6; // kph
			console.log('speed: '+speed);
			if(!speed) speed=0;
			if(unit=='mi') speed*=0.621371192; // mph
			txt=Math.round(speed);
			if(unit=='km') txt+=' kph';
			else txt+=' mph';
			id('speed').innerText=txt;
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
		lng=location.lng;
		window.localStorage.setItem('lat',lat);
		window.localStorage.setItem('lng',lng);
		console.log('location saved: '+lng+','+lat );
	}
	
	// TAP MAP
	function mapTap(e) {
		console.log('tap on map at '+e.latlng);
		if(routing) {
			var node={};
			node.latlng=e.latlng;
			nodes.push(node);
			if(nodes.length<2) {
				lastLoc.latlng=e.latlng;
				return;
			}
			dist=Math.round(map.distance(e.latlng,lastLoc.latlng));
			lastLoc.latlng=e.latlng;
			distance+=dist;
			if(nodes.length==2) track=L.polyline([nodes[0].latlng,nodes[1].latlng],{color:'green',weight:9,opacity:0.25}).addTo(map);
			else if(nodes.length>2) track.addLatLng(node.latlng);
			dist=distance/1000; // km
			if(unit=='mi') dist*=0.621371192; // miles
			id('distance').innerText=Math.round(dist*10)/10+unit;
			console.log(nodes.length+' nodes in route');
		}
		/* TEST POLYLINES
		latlngs.push(e.latlng);
		if(latlngs.length==2) {
			console.log('polyline: '+latlngs);
			testTrack=L.polyline(latlngs, {color: 'yellow'}).addTo(map);
		}
		if(latlngs.length>1) testTrack.setLatLngs(latlngs);
		*/
		else if(id('controls').style.display=='block') {
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
	
	/* LIST TRACKS
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
	*/
	// LIST ROUTES
	function listRoutes() {
		console.log('list '+routeNames.length+' routes');
		if(routeNames.length<1) return;
		id('list').innerHTML='';
		for(var i=0; i<routeNames.length; i++) {
  			var listItem = document.createElement('li');
  			// NEW CODE...
  			listItem.index=i;
  			listItem.innerText=routeNames[i];
  			listItem.addEventListener('click',function(){listIndex=this.index; showRouteDetail();}); // select a route
  			/* OLD CODE
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
			*/
			id('list').appendChild(listItem);
  		}
  		// id('list').innerHTML+='<li onclick="clear()">CLEAR</li>';
		show('listScreen',true);
		show('controls',false);
		show('moreControls',false);
	}
	
	// ADD TRACKPOINT
	function addTP() {
		var tp={};
		tp.latlng=loc.latlng;
		tp.alt=loc.alt;
		notify('trackpoint '+trackpoints.length+' at '+tp.latlng+' alt: '+tp.alt);
		tp.time=loc.time;
		trackpoints.push(tp);
		if(trackpoints.length<2) return;
		if(trackpoints.length==2) track=L.polyline([trackpoints[0].latlng,trackpoints[1].latlng],{color:'black',weight:9,opacity:0.25}).addTo(map);
		else if(trackpoints.length>2) track.addLatLng(tp.latlng);
	}
	
	// LOCATION FIX
	function getFix() { // get fix on current location
	console.log('get a fix');
		map.locate({watch: false, setView: false, enableHighAccuracy: true});
		id("actionButton").innerHTML='<img src="goButton24px.svg"/>';
		id("actionButton").removeEventListener("click", getFix);
		id("actionButton").addEventListener("click", go);
		ready=true;
		window.setTimeout(timeUp,15000); // revert to fix button after 15 secs
	}
	/*
	function gotoFix(position) {
		console.log("go to Fix");
		loc.lng=position.latlng.longitude;
		loc.lat=position.latlng.latitude;
		loc.alt=position.latlng.altitude;
		if(loc.alt!=null) loc.alt=Math.round(loc.alt);
		notify("fix at "+loc.lng+","+loc.lat+","+loc.alt);
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
		show('dash',true);
		show('moreControls', false);
		
		// TESTING
		id('duration').innerText='0:00';
		id('distance').innerText='0';
		id('speed').innerText='0';
		// speed=0;
		notify("start tracking");
		map.locate({watch:true, setView: false, enableHighAccuracy: true})
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
	
	// STOP TRACKING/ROUTING
	function cease(event) {
		/*
		if(routing) { // STOP only tpped to stop routing or tracking
			notify("stop routing with "+nodes.length+" nodes");
			routing=false;
			show('duration',true);
			show('speed',true);
			show('dash',false);
			if(nodes.length>5) { // offer to save route
				notify("save route?");
				id('saveName').value="";
				show('saveDialog',true);
			}
		}
		*/
		// else { // if not routing must be tracking
		notify("stop tracking with "+trackpoints.length+" trackpoints");
		map.stopLocate();
		show('dash',false);
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
		// }
		id("actionButton").innerHTML='<img src="fixButton24px.svg"/>';
		id("actionButton").removeEventListener("click", stopStart);
		id("actionButton").addEventListener("click", getFix);
		show('stopButton',false);
		// show('routeLength',false);
	}
	
	// POSITION MAP
	function centreMap() { // move map to current location
		// notify("centre map at N"+loc.lat+" E"+loc.lng);
		console.log('centreMap at '+loc.latlng);
		map.setView(loc.latlng,zoom);
		var i, x, y;
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
		// var avSpeed=distance*3.6/moving; // kph
		notify('distance:'+distance+' average speed:'+avSpeed+'kph');
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
			d=measure('distance',trackpoints[i-1].lng,trackpoints[i-1].lat,trackpoints[i].lng,trackpoints[i].lat);
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
			if(i>0) d+=measure('distance',t.lng,t.lat,trackpoints[i-1].lng,trackpoints[i-1].lat);
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
		// maxSpeed=Math.round((metric)?maxSpeed:maxSpeed*0.62137);
		// avSpeed=Math.round((metric)?avSpeed:avSpeed*0.62137);
		profilesCanvas.fillText(minAlt+'-'+maxAlt+'m',10,h-5);
		// notify("show profiles");
		show('profilesPanel',true);
	}
	
	// SAVE TRACK/ROUTE
	function saver() {
		var name=id("saveName").value;
		notify("save track/route as "+name);
		if((routeNames.indexOf(name)>=0)) {
			alert(name+" already in use");
			return;
		}
		var route={};
		route.distance=distance;
		if(nodes.length>0) route.nodes=nodes; // save new route
		else { // save track as route
			route.nodes=[];
			for(var i=0;i<trackpoints.length();i++) {
				route.nodes[i].latlng=trackpoints[i].latlng;
				// route.nodes[i].alt=trackpoints[i].alt; // forget trackpoint.time
			}
		}
		json=JSON.stringify(route);
		window.localStorage.setItem(name,json);
		routeNames.push(name);
		var routes={};
		routes.names=routeNames;
		notify("save routenames: "+routes.names);
		var json=JSON.stringify(routes);
		window.localStorage.setItem("saxtonRoutes",json);
		distance=0;
		show('saveDialog',false);
	}
	
	/* LOAD TRACK
	function loadTrack() {
		notify('load track '+listIndex+": "+trackNames[listIndex]);
		var json=window.localStorage.getItem(trackNames[listIndex]);
		var track=JSON.parse(json);
		distance=parseInt(track.distance);
		duration=parseInt(track.duration);
		moving=parseInt(track.moving);
		trackpoints=track.trackpoints;
		dist=0;
		notify("load track with "+trackpoints.length+" trackpoints; length: "+distance+"m; duration: "+duration+"sec");
		show('listScreen',false);
		loc.latlng=trackpoints[0].latlng; // NEW
		centreMap();
		// REPLACE WITH track POLYLINE redraw();
		show('actionButton',false);
		profiles();
	}
	*/
	// CLEAR TRACK/ROUTE
	function clear() {
	    notify('clear track/route');
	    trackpoints=[];
	    nodes=[];
	    show('actionButton',true);
	    // redraw();
	}
	
	/* DELETE TRACK
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
	*/
	// SHOW ROUTE DETAIL
	function showRouteDetail() {
		notify('show detail for route '+listIndex+' - '+routeNames[listIndex]);
		var json=window.localStorage.getItem(routeNames[listIndex]);
		var route=JSON.parse(json);
		distance=parseInt(route.distance)/1000; // km
		if(unit=='mi') distance*=0.621371192;
		distance=Math.floor(distance*10)/10;
		id('routeName').value=routeNames[listIndex];
		id('routeLength').innerText=distance+unit;
		show('routeDetail',true);
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
		loc.latlng=nodes[0].latlng; // NEW
		centreMap();
		var points=[];
		for(var i=0;i<nodes.length;i++) {
			points[i]=nodes[i].latlng;
		}
		console.log(points.length+' points: '+points);
		track=L.polyline(points,{color:'green',weight:9,opacity:0.25}).addTo(map);
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
	
	/*
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
	*/
	
	function decimal(n) {
	    return Math.floor(n * 10 + 0.5) / 10;
	}
	
	function show(element,visible) {
//		console.log('show '+element+' - '+visible);
	    id(element).style.display=(visible)?'block':'none';
	}
	
	function notify(note) {
		notifications.push(note);
		while(notifications.length>30) notifications.shift();
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
