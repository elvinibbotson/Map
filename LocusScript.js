	"use strict";
	var mode=null;
	var map; // CyclOSM map
	var x,y; 
	var json;
	var routing=false; // creating new route
	var ready=false;
	var tracking=false; // tracking GPS
	var following=false; // just following GPS
	var viewing=false; // viewing mmap while tracking
	var paused=false; // paused tracking
	var listIndex=0;
	var track; // route polyline on map
	var trace; // track polyline on map
	var trackpoints=[]; // array of track objects - locations, altitudes, timestamps
	var route;
	var routeNames=[];
	var place={}; // place name, location, etc
	var places=[]; // places resulting from 'find...' query
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
	var orsKey='5b3ce3597851110001cf6248d5e4d2e21e83467881592bdc4faa6001';
	var notifications=[];
	// EVENT HANDLERS
	id('modeButton').addEventListener('click', function(){
		if(mode=='walk') mode='bike';
		else mode='walk';
		setMode();
	});
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
	id('followButton').addEventListener('click',follow);
	id('trackButton').addEventListener('click',track);
	id("saveButton").addEventListener("click",saveRoute);
	id('moreButton').addEventListener('click',function(){
		show('moreButton',false);
		id('moreControls').style.display='block';
	});
	id('routeButton').addEventListener('click',function(){
		routing=true;
		distance=0;
		dist=0;
		ascent=0;
		lastLoc={};
		nodes=[];
		var node={};
		notify("routing");
		show('actionButton',false);
		show('moreControls',false);
		/*
		show('dash',true);
		id('duration').innerText='route';
		show('speed',false);
		show('finishButton',true);
		show('cancelRouting',true);
		*/
		show('routing',true);
		if(track) track.remove(); // remove any earlier route
	});
	id('cancelRouting').addEventListener('click',function() {
		routing=false;
		show('routing',false);
		show('actionButton',true);
		show('moreButton',true);
	})
	id('finishButton').addEventListener('click',finishRoute);
	id('routesButton').addEventListener('click',listRoutes);
	id('routeName').addEventListener('change',renameRoute);
	id('loadButton').addEventListener('click',loadRoute);
	id('deleteButton').addEventListener('click',deleteRoute);
	id('findText').addEventListener('change',function(){
		console.log('find '+id('findText').value);
		var request= new XMLHttpRequest();
		request.open('GET','https://api.openrouteservice.org/geocode/search?api_key='+orsKey+'&text='+id('findText').value+'&size=10');
		request.setRequestHeader('Accept', 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8');
		request.onreadystatechange=function() {
			console.log('request state: '+this.readyState);
			if(this.readyState===4) {
				console.log('status: ',this.status);
				console.log('headers: ',this.getAllResponseHeaders());
				console.log('body: ',this.responseText);
				json=JSON.parse(this.responseText);
				console.log(json.features.length+' features...');
				places=[];
				for(var i=0;i<json.features.length;i++) {
					place={};
					place.name=json.features[i].properties.name;
					place.region=json.features[i].properties.region;
					place.country=json.features[i].properties.country;
					place.location=json.features[i].geometry.coordinates;
					console.log(place.name+', '+place.country+', '+place.location);
					places.push(place);
				}
				if(places.length>0) listPlaces();
			}
		}
		request.send();
	})
	id('unitButton').addEventListener('click',function(){
		if(unit=='km.') unit='mi.';
		else unit='km.'; // toggle distance unit
		id('unitButton').innerHTML='&nbsp;'+unit;
		window.localStorage.setItem('unit',unit);
	});
	// id('notifyButton').addEventListener('click',showNotifications);
	id("cancelSave").addEventListener("click", function(){
	  show('saveDialog',false);
	  show('moreButton',true);
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
	show('moreButton',true);
	show('moreControls',false);
	show('routeButton',true);
	show('routesButton',true);
	show('unitButton',true);
	mode=window.localStorage.getItem('mode');
	console.log('mode: '+mode);
	if(!mode) mode='walk';
	// show('notifyButton',true);
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
	if(unit==null) {
		unit='km';
		window.localStorage.setItem('unit',unit);
	}
	json=JSON.parse(window.localStorage.getItem("LocusRoutes"));
	if(json!==null) {
		routeNames=json.names;
		notify(routeNames.length+' routes');
	}
	console.log('unit: '+unit);
	id('unitButton').innerHTML='&nbsp;'+unit;
	map=L.map('map',{zoomControl: false}).setView([lat,lng],zoom); // default location in Derbyshire
	setMode();
	map.on('moveend',saveLoc);
	map.on('zoom',function(){
		zoom=map.getZoom();
		window.localStorage.setItem('zoom',zoom);
	});
	map.on('click',mapTap); // NEW
	map.on('locationfound',function(e) {
		loc.latlng=e.latlng;
		if(!viewing) centreMap(); // map follows location unless viewing
		notify('centred at '+loc.latlng+'; tracking is '+tracking+' following is '+following);
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
	// SET MODE
	function setMode() {
		if(mode=='walk') L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    		maxZoom: 19,
    		attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
		}).addTo(map); // CyclOSM
		else L.tileLayer('https://dev.c.tile.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', {
    		maxZoom: 20,
    		attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; CyclOSM'
		}).addTo(map); // basic OSM
		id('modeButton').innerText=mode;
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
		if(id('goMode').style.display=='block') show('goModes',false);
		else if(routing) {
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
			id('routeDistance').innerText=decimal(dist)+unit;
			console.log(nodes.length+' nodes in route');
		}
		else if(id('controls').style.display=='block') {
			show('controls',false);
			show('moreControls',false);
			// show('more',false);
		}
		else if(id('listScreen').style.display=='block') show('listScreen',false);
		else if(id('routeDetail').style.display=='block') show('routeDetail',false);
		else {
			id('findText').value='';
			show('controls',true);
			// show('moreControls',true);
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
		lastLoc.alt=tp.alt;
		if(trackpoints.length==2) trace=L.polyline([trackpoints[0].latlng,trackpoints[1].latlng],{color:'black',weight:9,opacity:0.25}).addTo(map);
		else if(trackpoints.length>2) trace.addLatLng(tp.latlng);
	}
	// LOCATION FIX
	function getFix() { // get fix on current location
		console.log('get a fix');
		map.locate({watch: false, setView: false, enableHighAccuracy: true});
		id("actionButton").innerHTML='<img src="goButton24px.svg"/>';
		id("actionButton").removeEventListener("click",getFix);
		id("actionButton").addEventListener("click",goMode);
		ready=true;
		window.setTimeout(timeUp,10000); // revert to fix button after 10 secs
	}
	function timeUp() {
		if(tracking||following) return;
		console.log("time's up - back to fix button");
		id("actionButton").innerHTML='<img src="fixButton24px.svg"/>';
		id("actionButton").removeEventListener("click", goMode);
		id("actionButton").addEventListener("click", getFix);
		ready=false;
	}
	// TRACK/FOLLOW OPTION
	function goMode() {
		show('goMode',true);
	}
	// TRACKING FUNCTIONS
	function follow() { // start following GPS
		notify('start following GPS');
		ready=false;
		following=true;
		viewing=false;
		loc={};
		map.locate({watch:true, setView: false, enableHighAccuracy: true});
		id("actionButton").innerHTML='<img src="stopButton24px.svg"/>';
		id("actionButton").removeEventListener("click",goMode);
		id("actionButton").addEventListener("click",cease);
		show('goMode',false);
	}
	function track() { // start tracking location
		notify('start tracking GPS');
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
		// show('finishButton',false);
		// show('cancelRouting',false);
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
		id("actionButton").innerHTML='<img src="stopButton24px.svg"/>';
		id("actionButton").removeEventListener("click",goMode);
		id("actionButton").addEventListener("click", cease);
		show('goMode',false);
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
		if(following) notify('stop following GPS');
		else notify("stop tracking with "+trackpoints.length+" trackpoints");
		map.stopLocate();
		show('dash',false);
		following=tracking=false;
		if(trackpoints.length>5) { // offer to save track
			name='';
			var now=new Date();
			var name=now.getFullYear()+months.substr(now.getMonth()*3,3);
			var n=now.getDate();
			if(n<10) name+='0';
			name+=(n+'-'); // YYYYmonDD-
			n=now.getHours();
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
		else show('moreButton',true);
		id("actionButton").innerHTML='<img src="fixButton24px.svg"/>';
		id("actionButton").removeEventListener("click",cease);
		id("actionButton").addEventListener("click",getFix);
	}
	// POSITION MAP
	function centreMap() { // move map to current location
		console.log('centreMap at '+loc.latlng);
		map.setView(loc.latlng,zoom);
		var i,x,y;
		saveLoc();
	}
	// LIST PLACES
	function listPlaces() {
		console.log('list '+places.length+' places');
		id('list').innerHTML='';
		var listItem=document.createElement('li');
		listItem.innerHTML='<b>PLACES</b>';
		id('list').appendChild(listItem);
		for(var i=0;i<places.length;i++) {
			listItem = document.createElement('li');
  			listItem.index=i;
  			listItem.innerText=places[i].name+', '+places[i].region+', '+places[i].country;
  			listItem.addEventListener('click',function(){listIndex=this.index; goToPlace();}); // select a route
			id('list').appendChild(listItem);
		}
		show('listScreen',true);
		show('controls',false);
		show('moreControls',false);
		show('more',false);
	}
	// CENTRE MAP AT PLACE
	function goToPlace() {
		var place=places[listIndex];
		console.log('go to '+place.location);
		lat=place.location[1];
		lng=place.location[0];
		console.log('lat: '+lat+'; lng: '+lng);
		loc.latlng=[lat,lng];
		console.log('go to '+loc.latlng);
		show('listScreen',false);
		centreMap();
	}
	// FINISH ROUTING
	function finishRoute() {
		notify("stop routing with "+nodes.length+" nodes");
		routing=false;
		// show('duration',true);
		// show('speed',true);
		show('routing',false);
		// show('finishButton',false);
		show('actionButton',true);
		var request= new XMLHttpRequest();
		if(mode=='walk') request.open('POST','https://api.openrouteservice.org/v2/directions/foot-walking/geojson');
		else request.open('POST','https://api.openrouteservice.org/v2/directions/cycling-regular/geojson');
		request.setRequestHeader('Accept','application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8');
		request.setRequestHeader('Content-type','application/json');
		request.setRequestHeader('Authorization',orsKey);
		request.onreadystatechange=function() {
			if(this.readyState===4) {
				console.log('status',this.status);
				console.log('body',this.responseText);
				json=JSON.parse(this.responseText);
				console.log(json.features.length+' features');
				distance=json.features[0].properties.summary.distance;
				var coords=json.features[0].geometry.coordinates;
				var coord;
				nodes=[];
				var node;
				var climb;
				var climbing=false; // high/low points when switches true/false
				ascent=0;
				for(var i=0;i<coords.length;i++) {
					node={};
					coord=coords[i];
					node.latlng=L.latLng(coord[1],coord[0]);
					node.alt=Math.round(coord[2]);
					if((i<1)||(i==coords.length-1)) node.elev=true; // elevation at start and end nodes
					else node.elev=false; // most nodes do not have elevations
					nodes.push(node);
					if(i>0) {
						climb=(node.alt-nodes[nodes.length-2].alt)
						if(climb>0) ascent+=climb;
					}
					if((climb>0)&&(!climbing)) {
						nodes[i-1].elev=true; // ...add elevations at low points...
						climbing=true;
					}
					else if((climb<0)&&(climbing)) {
						nodes[i-1].elev=true; // ...and high points
						climbing=false;
					}
				}
				console.log('route length: '+distance+'; '+nodes.length+'nodes; node[0]: '+nodes[0].latlng+'; alt: '+nodes[0].alt);
				coords=[];
				for(i=0;i<nodes.length;i++) {coords.push(nodes[i].latlng)}
				console.log('new route: '+coords);
				track.remove(); // replace old route with new one
				track=L.polyline(coords,{color:'red',weight:9,opacity:0.25}).addTo(map);
				// add elevations
				console.log(nodes.length+' nodes');
				for(i=0;i<nodes.length;i++) {
					if(nodes[i].elev){
						console.log('add elevation to node '+i);
						var elev=L.divIcon({html: nodes[i].alt, className: 'elevIcon'});
						L.marker(nodes[i].latlng,{icon:elev}).addTo(map);
					}
				}
				
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
		window.localStorage.setItem("LocusRoutes",json);
		notify('route names saved');
		distance=0;
		show('saveDialog',false);
	}
	// LIST ROUTES
	function listRoutes() {
		console.log('list '+routeNames.length+' routes');
		if(routeNames.length<1) return;
		id('list').innerHTML='';
		var listItem=document.createElement('li');
		listItem.innerHTML='<b>ROUTES</b>';
		id('list').appendChild(listItem);
		for(var i=0;i<routeNames.length;i++) {
  			listItem = document.createElement('li');
  			listItem.index=i;
  			listItem.innerText=routeNames[i];
  			listItem.addEventListener('click',function(){listIndex=this.index; showRouteDetail();}); // select a route
			id('list').appendChild(listItem);
  		}
		show('listScreen',true);
		show('controls',false);
		show('moreControls',false);
	}
	// SHOW ROUTE DETAIL
	function showRouteDetail() {
		notify('show detail for route '+listIndex+' - '+routeNames[listIndex]);
		var json=window.localStorage.getItem(routeNames[listIndex]);
		var route=JSON.parse(json);
		distance=parseInt(route.distance)/1000; // km
		if(unit=='mi') distance*=0.621371192;
		distance=decimal(distance);
		id('routeName').value=routeNames[listIndex];
		id('routeLength').innerText=distance+unit;
		id('routeAscent').innerText=Math.round(route.ascent)+'m';
		show('listScreen',false);
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
		window.localStorage.setItem("LocusRoutes",json);
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
		show('routeDetail',false);
		loc.latlng=nodes[0].latlng; // NEW
		centreMap();
		var points=[];
		for(var i=0;i<nodes.length;i++) {
			points[i]=nodes[i].latlng;
			if(nodes[i].elev) { // draw elevations at high/low points
				console.log('add elevation to node '+i);
				var elev=L.divIcon({html: nodes[i].alt, className: 'elevIcon'});
				L.marker(nodes[i].latlng,{icon:elev}).addTo(map);
			}
		}
		/*
		if(track) {
			console.log('remove earlier track');
			track.remove(); // remove any earlier route
		// }
		*/
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
		window.localStorage.setItem("LocusRoutes",json);
		window.localStorage.removeItem(name);
		notify(name+" deleted");
		show('routeDetail',false);
		listRoutes();
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
