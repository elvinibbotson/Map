	"use strict";
	var map; // CyclOSM map
	var x,y; 
	var json;
	var routing=false; // creating new route
	var ready=false;
	var tracking=false; // tracking movement
	var viewing=false; // viewing mmap while tracking
	var paused=false; // paused tracking
	var listIndex=0;
	var track; // route polyline on map
	var trace; // track polyline on map
	var trackpoints=[]; // array of track objects - locations, altitudes, timestamps
	var route;
	var routeNames=[];
	var nodes=[]; // array of route node locations
	var unit='km';
	var zoom=10;
	var loc={};
	var lastLoc={};
	var fix;
	var lng,lat,dist,distance,ascent,duration; // fix & track data
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
	// id("stopButton").addEventListener("click",cease);
	id("saveButton").addEventListener("click",saveRoute);
	id('moreButton').addEventListener('click',function(){
		show('moreButton',false);
		id('more').style.display='block';
	});
	id('routeButton').addEventListener('click',function(){
		routing=true;
		// route={};
		distance=0;
		dist=0;
		ascent=0;
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
		if(track) track.remove(); // remove any earlier route
	});
	id('finish').addEventListener('click',finishRoute);
	id('routesButton').addEventListener('click',listRoutes);
	id('closeButton').addEventListener('click',function(){
	    show('listScreen',false);
	    trackpoints=[];
	    nodes=[];
	    show('actionButton',true);
	});
	id('routeName').addEventListener('change',renameRoute);
	id('loadButton').addEventListener('click',loadRoute);
	id('deleteButton').addEventListener('click',deleteRoute);
	id('unitButton').addEventListener('click',function(){
		if(unit=='km') unit='mi';
		else unit='km'; // toggle distance unit
		id('unitButton').innerText=unit;
		window.localStorage.setItem('unit',unit);
	});
	id('helpButton').addEventListener('click',function(){show('helpScreen',true)});
	id('closeHelpButton').addEventListener('click',function(){show('helpScreen',false)});
	id("cancelButton").addEventListener("click", function(){
	  show('saveDialog',false);
	  routing=false;
	  nodes=[];
	});
	var sw=screen.width; // WAS window.innerWidth;
	var sh=screen.height; // WAS window.innerHeight;
	console.log("screen size: "+sw+"x"+sh);
	id('map').style.width=sw+'px';
	id('map').style.height=sh+'px';
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
	json=JSON.parse(window.localStorage.getItem("saxtonRoutes"));
	if(json!==null) {
		routeNames=json.names;
		notify(routeNames.length+' routes');
	}
	console.log('unit: '+unit);
	id('unitButton').innerText=unit;
	map=L.map('map',{zoomControl: false}).setView([lat,lng],zoom); // default location in Derbyshire
	/* standard OSM
	L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    	maxZoom: 19,
    	attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
	}).addTo(map);
	*/https://vtiles.openhistoricalmap.org/maps/osm/{z}/{x}/{y}.pbf
	// CyclOSM
	L.tileLayer('https://dev.c.tile.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', {
    	maxZoom: 20,
    	attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; CyclOSM'
	}).addTo(map);
	map.on('moveend',saveLoc);
	map.on('zoom',function(){
		zoom=map.getZoom();
		window.localStorage.setItem('zoom',zoom);
	});
	map.on('click',mapTap); // NEW
	map.on('locationfound',function(e) {
		loc.latlng=e.latlng;
		if(!viewing) centreMap(); // map follows location unless viewing
		console.log('centred at '+loc.latlng+'; tracking is '+tracking);
		loc.alt=Math.round(e.altitude);
		loc.time=e.timestamp;
		console.log('location is '+loc.latlng+' altitude: '+loc.alt+' time: '+loc.time);
		if(!tracking) return;
		if(trackpoints.length<1) {
			addTP(loc.latlng); // ...add first trackpoint
			lastLoc.latlng=loc.latlng;
			lastLoc.time=loc.time;
			lastLoc.alt=loc.alt;
			duration=0;
		}
		else {
			console.log('lastLoc: '+lastLoc.latlng+'; fix at '+loc.latlng);
			dist=Math.round(map.distance(loc.latlng,lastLoc.latlng));
			console.log('fix - distance: '+dist+'m');
			if(dist>10) { // trackpoints every 10m INCREASE THIS?
				addTP(loc.latlng);
				lastLoc.latlng=loc.latlng;
				duration+=(loc.time-lastLoc.time);
				lastLoc.time=loc.time;
				distance+=dist;
			}
			else { // check if pausing
				if((loc.time-lastLoc.time)>60000) { // moved <10m in 1 minute
					lastLoc.time=loc.time; // ensure pause not added to duration
				}
			}
			var txt='';
			// var duration=Math.floor(loc.time-trackpoints[0].time)/60000; // minutes - OLD CODE
			var elapsed=duration/60000; // minutes
			txt=Math.floor(elapsed/60)+':'; // HH:
			console.log('hours: '+txt);
			elapsed%=60; // minutes
			elapsed=Math.floor(elapsed);
			if(elapsed<10) txt+='0';
			txt+=elapsed; // HH:MM
			console.log('elapsed time: '+txt);
			id('duration').innerText=txt;
			dist=distance/1000; // km 
			if(unit=='mi') dist*=0.621371192; // miles
			console.log('distance: '+dist)
			txt=decimal(dist)+' '+unit;
			// txt=Math.floor(dist*10)/10;
			// if(unit=='km') txt+=' kph';
			// else txt+=' mph';
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
	// SAVE LOCATION
	function saveLoc() {
		var location=map.getCenter();
		console.log('map location: '+location);
		lat=location.lat;
		lng=location.lng;
		window.localStorage.setItem('lat',lat);
		window.localStorage.setItem('lng',lng);
		console.log('location saved: '+lng+','+lat );
		// NEW CODE TO  ALLOW VIEWING MAP WHILE TRACKING
		if(tracking) {
			viewing=true;
			window.setTimeout(stopViewing,30000);
			notify('allow map viewing');
		}
	}
	// STOP VIEWING AFTER 30 SECONDS AND CONTINUE TRACKING
	function stopViewing() {
		notify('end map viewing');
		viewing=false;
	}
	// TAP MAP
	function mapTap(e) {
		console.log('tap on map at '+e.latlng);
		if(routing) {
			var node={};
			node.latlng=e.latlng;
			node.alt=0;
			nodes.push(node);
			if(nodes.length<2) {
				lastLoc.latlng=e.latlng;
				return;
			}
			dist=Math.round(map.distance(e.latlng,lastLoc.latlng));
			lastLoc.latlng=e.latlng;
			distance+=dist;
			if(nodes.length==2) track=L.polyline([nodes[0].latlng,nodes[1].latlng],{color:'red',weight:9,opacity:0.25}).addTo(map);
			else if(nodes.length>2) track.addLatLng(node.latlng);
			dist=distance/1000; // km
			if(unit=='mi') dist*=0.621371192; // miles
			id('distance').innerText=decimal(dist)+unit;
			// id('distance').innerText=Math.round(dist*10)/10+unit;
			console.log(nodes.length+' nodes in route');
		}
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
	// ADD TRACKPOINT
	function addTP() {
		var tp={};
		tp.latlng=loc.latlng;
		tp.alt=loc.alt;
		notify('trackpoint '+trackpoints.length+' at '+tp.latlng+' alt: '+tp.alt+'m');
		tp.time=loc.time;
		trackpoints.push(tp);
		if(trackpoints.length<2) return;
		var climb=tp.alt-lastLoc.alt; // WAS (tp.alt-trackpoints[trackpoints.length-2].alt);
		if(climb>0) ascent+=climb;
		notify('climb: '+climb+'; ascent: '+ascent);
		if(trackpoints.length==2) trace=L.polyline([trackpoints[0].latlng,trackpoints[1].latlng],{color:'black',weight:9,opacity:0.25}).addTo(map);
		else if(trackpoints.length>2) trace.addLatLng(tp.latlng);
	}
	// LOCATION FIX
	function getFix() { // get fix on current location
		console.log('get a fix');
		map.locate({watch: false, setView: false, enableHighAccuracy: true});
		id("actionButton").innerHTML='<img src="goButton24px.svg"/>';
		id("actionButton").removeEventListener("click",getFix);
		id("actionButton").addEventListener("click",go);
		ready=true;
		window.setTimeout(timeUp,10000); // revert to fix button after 10 secs
	}
	function timeUp() {
		if(tracking) return;
		console.log("times up - back to fix button");
		id("actionButton").innerHTML='<img src="fixButton24px.svg"/>';
		id("actionButton").removeEventListener("click", go);
		id("actionButton").addEventListener("click", getFix);
		ready=false;
	}
	// TRACKING FUNCTIONS
	function go() { // start tracking location
		ready=false;
		tracking=true;
		viewing=false;
		trackpoints=[];
		loc={};
		lastLoc={};
		distance=0;
		duration=0;
		ascent=0;
		show('dash',true);
		show('finish',false);
		show('moreControls', false);
		id('duration').innerText='0:00';
		id('distance').innerText='0 '+unit;
		var txt='0 ';
		if(unit=='km') txt+=' kph';
		else txt+='mph';
		id('speed').innerText=txt;
		notify("start tracking");
		if(trace) trace.remove();
		map.locate({watch:true, setView: false, enableHighAccuracy: true});
		// id("actionButton").innerHTML='<img src="pauseButton24px.svg"/>';
		id("actionButton").innerHTML='<img src="stopButton24px.svg"/>';
		id("actionButton").removeEventListener("click",go);
		// id("actionButton").addEventListener("click", stopStart);
		id("actionButton").addEventListener("click", cease);
		// show('measure',false);
	}
	/*
	function stopStart() {
		notify("stopStart - "+(tracking)?'pause':'resume'+' tracking');
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
		tracking=true;
		map.locate({watch:true, setView: false, enableHighAccuracy: true});
		notify('tracking resumed');
	}
	*/
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
		notify("stop tracking with "+trackpoints.length+" trackpoints");
		map.stopLocate();
		show('dash',false);
		if(trackpoints.length>5) { // offer to save track
				name='';
				var now=new Date();
				var name=now.getFullYear()+months.substr(now.getMonth()*3,3);
				var n=now.getDate();
				if(n<10) name+='0';
				name+=(n+'-'); // YYYYmonDD-
				n =now.getHours();
				if(n<10) name+="0";
				name+=(n+":");
				n=now.getMinutes();
				if(n<10) name+="0";
				name+=n; // YYmonDD-HH-mm
				notify("track name: "+name);
				id("saveName").value=name;
				dist=distance/1000; // km
				if(unit=='mi') dist*=0.621371;
				dist=decimal(dist); // one decimal place
				ascent=Math.round(ascent); // whole m
				notify('save track length: '+dist+'; '+ascent+'m ascent');
				id('saveDistance').innerText=dist+unit;
				id('saveAscent').innerText=ascent+'m';
				show('saveDialog',true);
			}
		id("actionButton").innerHTML='<img src="fixButton24px.svg"/>';
		// id("actionButton").removeEventListener("click", stopStart);
		id("actionButton").removeEventListener("click",cease);
		id("actionButton").addEventListener("click",getFix);
		// show('stopButton',false);
	}
	// POSITION MAP
	function centreMap() { // move map to current location
		// notify("centre map at N"+loc.lat+" E"+loc.lng);
		console.log('centreMap at '+loc.latlng);
		map.setView(loc.latlng,zoom);
		var i, x, y;
		saveLoc();
	}
	// FINISH ROUTING
	function finishRoute() {
		notify("stop routing with "+nodes.length+" nodes");
		routing=false;
		show('duration',true);
		show('speed',true);
		show('dash',false);
		show('finish',false);
		show('actionButton',true);
		// OPEN ROUTE SERVICE
		var KEY='5b3ce3597851110001cf6248d5e4d2e21e83467881592bdc4faa6001';
		var request= new XMLHttpRequest();
		request.open('POST','https://api.openrouteservice.org/v2/directions/cycling-electric/geojson');
		request.setRequestHeader('Accept','application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8');
		request.setRequestHeader('Content-type','application/json');
		request.setRequestHeader('Authorization',KEY);
		request.onreadystatechange=function() {
			if(this.readyState===4) {
				console.log('status',this.status);
				console.log('body',this.responseText);
				json=JSON.parse(this.responseText);
				console.log(json.features.length+' features');
				distance=json.features[0].properties.summary.distance;
				// var ascent=json.features[0].properties.ascent;
				var coords=json.features[0].geometry.coordinates;
				var coord;
				nodes=[];
				var node;
				var climb;
				ascent=0;
				for(var i=0;i<coords.length;i++) {
					node={};
					coord=coords[i];
					node.latlng=L.latLng(coord[1],coord[0]);
					node.alt=coord[2];
					nodes.push(node);
					if(i>0) climb=(node.alt-nodes[nodes.length-2].alt);
					if(climb>0) ascent+=climb;
				}
				console.log('route length: '+distance+'; '+nodes.length+'nodes; node[0]: '+nodes[0].latlng+'; alt: '+nodes[0].alt);
				coords=[];
				for(i=0;i<nodes.length;i++) {coords.push(nodes[i].latlng)}
				console.log('new route: '+coords);
				track.remove(); // replace old route with new one
				track=L.polyline(coords,{color:'red',weight:9,opacity:0.25}).addTo(map);
				notify("save route?");
				id('saveName').value="";
				dist=distance/1000; // km
				if(unit=='mi') dist*=0.621371; // miles
				dist=decimal(dist);
				// dist=Math.round(dist*10)/10;
				id('saveDistance').innerText=dist+unit;
				id('saveAscent').innerText=Math.round(ascent)+'m';
				console.log()
				show('saveDialog',true);
			}
		};
		var body='{"coordinates":[['+nodes[0].latlng.lng+','+nodes[0].latlng.lat+']';
		console.log('body: '+body);
		for(var i=1;i<nodes.length;i++) {
			body+=',['+nodes[i].latlng.lng+','+nodes[i].latlng.lat+']';
		}
		body+='],"elevation":"true","geometry_simplify":"true"}';
		console.log('body: '+body);
		request.send(body);
	}
	// SAVE TRACK/ROUTE
	function saveRoute() {
		var name=id("saveName").value;
		notify("save track/route as "+name+' - '+trackpoints.length+' trackpoints, '+nodes.length+' nodes');
		if((routeNames.indexOf(name)>=0)) {
			alert(name+" already in use");
			return;
		}
		var route={};
		route.distance=distance;
		route.ascent=ascent;
		if(trackpoints.length>0) { // stop tracking - save track as route
			notify('saving track as route - length: '+route.distance);
			route.nodes=[];
			for(var i=0;i<trackpoints.length;i++) {
				route.nodes[i]={};
				route.nodes[i].latlng=trackpoints[i].latlng;
				route.nodes[i].alt=trackpoints[i].alt;
			}
			notify('track ready to save - length: '+route.distance+', ascent: '+route.ascent+', '+route.nodes.length+' nodes');
			// trace.remove(); // remove track from map
		}
		else if(nodes.length>0) route.nodes=nodes; // save new route
		json=JSON.stringify(route);
		window.localStorage.setItem(name,json);
		notify('route saved');
		routeNames.push(name);
		var routes={};
		routes.names=routeNames;
		notify("save routenames: "+routes.names);
		var json=JSON.stringify(routes);
		window.localStorage.setItem("saxtonRoutes",json);
		notify('route names saved');
		distance=0;
		show('saveDialog',false);
	}
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
			id('list').appendChild(listItem);
  		}
		show('listScreen',true);
		show('controls',false);
		show('more',false);
	}
	// SHOW ROUTE DETAIL
	function showRouteDetail() {
		notify('show detail for route '+listIndex+' - '+routeNames[listIndex]);
		var json=window.localStorage.getItem(routeNames[listIndex]);
		var route=JSON.parse(json);
		distance=parseInt(route.distance)/1000; // km
		if(unit=='mi') distance*=0.621371192;
		distance=decimal(distance);
		// distance=Math.floor(distance*10)/10;
		id('routeName').value=routeNames[listIndex];
		id('routeLength').innerText=distance+unit;
		id('routeAscent').innerText=Math.round(route.ascent)+'m';
		show('routeDetail',true);
	}
	// RENAME ROUTE
	function renameRoute() {
		var oldName=routeNames[listIndex];
		var newName=id('routeName').value;
		notify('rename route '+listIndex+": "+oldName+ ' to '+newName);
		routeNames[listIndex]=newName;
		var json=window.localStorage.getItem(oldName);
		window.localStorage.setItem(newName,json);
		window.localStorage.removeItem(oldName);
		var routes={};
		routes.names=routeNames;
		notify("save routenames: "+routes.names);
		json=JSON.stringify(routes);
		window.localStorage.setItem("saxtonRoutes",json);
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
		if(track) track.remove(); // remove any earlier route
		track=L.polyline(points,{color:'red',weight:9,opacity:0.25}).addTo(map);
	}
	// DELETE ROUTE
	function deleteRoute() {
		var name=routeNames[listIndex];
		var del=confirm('delete route '+name);
		console.log('del is '+del);
		if(del===false) return;
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
	function decimal(n) {
	    return Math.floor(n * 10 + 0.5) / 10;
	}
	function show(element,visible) {
	    id(element).style.display=(visible)?'block':'none';
	}
	function notify(note) {
		notifications.push(note);
		while(notifications.length>20) notifications.shift();
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
