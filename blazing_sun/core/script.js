'use strict';
	
class BingoTiketSistem {

constructor(iy1, iy2) {

    this._iy1 = iy1;
    this._iy2 = iy2;

 
			this.napraviSablon(iy1,iy2);
			
		if(user.instance.isLoggedIn()){
			this.napisiSistemKvota();
		}
		else{
			this.napisiSistemKvotaLow();
		}

  }
  
sortiraj(){
	 let mdd1= document.getElementById("section1");

	let targetDiv = document.getElementById("section1").getElementsByClassName("circle");
	let arr =[];
	
	for (let i=0; i <targetDiv.length; i++){
		
		arr.push(targetDiv[i].innerHTML);
	}
	arr.sort(function(a, b){return a - b});

	glavniSablon.instance.cleanElement("section1");

	
	for (let i = 0; i<arr.length; i++){
		let broj = document.createElement("div");
		broj.setAttribute("class", "circle");
		broj.setAttribute("onclick", "bingo.instance.dodajBroj(this)");
		broj.innerHTML = arr[i];
		mdd1.appendChild(broj);
		
	}
}

dodajBroj(me) {
  let x = document.getElementsByClassName("numbersContainer");
  let y = document.getElementById('editField');

  
  

 

  
  
  me.setAttribute('onclick','bingo.instance.obrisiBroj(this)');
if(y){
	
	y.parentNode.appendChild(me);

}


  
  
if(this._iy2==4){
	
	

			this._iy2=0;
		
			
			document.getElementById('section1').style.pointerEvents='none';
	
	if(y){
	
	y.parentNode.appendChild(me);

}else{
x[this._iy1].appendChild(me);
}
			
	
}
else{




	if(y){
	
	y.parentNode.appendChild(me);

}else{
x[this._iy1].appendChild(me);
}

this._iy2++;
}



}

editujTiket(me){
	this._iy1--;
		 let mdd1= document.getElementById("section1");
	  let mdd2= document.getElementById("section2");
	let button = document.getElementById("mainButton");

button.style.pointerEvents='none';

		

		
			let x = me.parentNode.getElementsByClassName('circle');
					for(let i=0;i<x.length;i++){
					 this._iy2++;
					 
				}
	

	
	mdd1.style.pointerEvents='all';



		button.setAttribute('style','display:none;');
	 
	let editButton = document.createElement("div");
			editButton.setAttribute("class", "button");
			editButton.setAttribute("id", "editButton");
			editButton.setAttribute('style','border:5px solid green; display:block;margin-top:1%;');
			editButton.setAttribute("onclick", "bingo.instance.predajTiket()");
			editButton.innerHTML = 'Editujte tiket';
		
	let editField = document.createElement("div");
			editField.setAttribute("id", "editField");
			editField.setAttribute('style','display:none;');
		console.log(me.parentNode);
		me.parentNode.appendChild(editField);	
		mdd2.appendChild(editButton);
		
		
let arr1 =[];
let arr2 =[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30];	
	let xx= me.parentNode.getElementsByClassName('circle');
	for(let i=0;i<xx.length;i++){
		 xx[i].setAttribute('style','pointer-events:all;');
		 arr1.push(parseInt(xx[i].innerHTML)-1);
		 
	}
	
	arr1.sort(function(a, b){return a - b});

for (var i = arr1.length -1; i >= 0; i--){
	 arr2.splice(arr1[i],1);
}
  
glavniSablon.instance.cleanElement("section1");

	for (let i = 0; i<arr2.length; i++){
		let broj = document.createElement("div");
		broj.setAttribute("class", "circle");
		broj.setAttribute("onclick", "bingo.instance.dodajBroj(this)");
		broj.innerHTML = arr2[i];
		mdd1.appendChild(broj);
		
	}

}

obrisiBroj(me){


		

	
if(this._iy2 == 0){
	this._iy2=5;

		}
	
document.getElementById('section1').style.pointerEvents='all';

	  let kk =document.getElementById("section1");
	  kk.appendChild(me);
	  me.setAttribute('onclick','bingo.instance.dodajBroj(this)');
			bingo.instance.sortiraj();
	this._iy2--; 
}

dodajTiket() {
document.getElementById('section1').style.pointerEvents='all';


	  let mdd4= document.getElementById("section4");


	let uu = mdd4.getElementsByClassName('xsym');
	let yy = mdd4.getElementsByClassName('esym');
	for (let i=0; i<uu.length;i++){
		uu[i].style.pointerEvents='none';
		yy[i].style.pointerEvents='none';
	}



let button = document.getElementById("mainButton");
button.innerHTML='Predaj Tiket';
button.setAttribute("onclick", "bingo.instance.predajTiket()");
button.style.pointerEvents='all';
 var x = mdd4.getElementsByClassName("numbersContainer");
console.log(this._iy1);
		x[this._iy1].style.background= 'green';
		
		
		let xsym = document.createElement("span");
			xsym.setAttribute("class", "xsym");
			xsym.setAttribute("id", "xsym");
			xsym.setAttribute("onclick", "bingo.instance.izbrisiTiket(this)");
			xsym.innerHTML = '&#10006;';
			xsym.style.pointerEvents='none';
			
		let esym = document.createElement("span");
			esym.setAttribute("class", "esym");
			esym.setAttribute("id", "esym");
			esym.setAttribute("onclick", "bingo.instance.editujTiket(this)");
			esym.innerHTML = '&#9998;';
			esym.style.pointerEvents='none';		
		
		
		x[this._iy1].appendChild(xsym);
		x[this._iy1].appendChild(esym);

}

pripremiObjekat(){
	 let mdd4= document.getElementById("section4");
	let element = []; 
	let cuke;
	for(let i =0; i<mdd4.getElementsByClassName('numbersContainer').length;i++){
		cuke=''

		for(let j = 0; j<mdd4.getElementsByClassName('numbersContainer')[i].getElementsByClassName('circle').length;j++){
			 
			cuke +=mdd4.getElementsByClassName('numbersContainer')[i].getElementsByClassName('circle')[j].innerHTML +',';
	
		
	
		}

		cuke = cuke.slice(0, -1)
		cuke += '|';
		

		  
		element.push(cuke);
	
	
		
	
	}
	forntCommController.instance.posaljiServeru('vratiRand',element);
	

}

odigraj (){
	



bingo.instance.pripremiObjekat();


		
	
	
	
}

obnoviSablon() {
 this._iy1 = 0;
 this._iy2 = 0;

	this.napraviSablon(this._iy1,this._iy2);	


	




  }

zapocniIgru(rande){
	console.log(JSON.parse(JSON.parse(rande).izvestaj));
var rand = JSON.parse(JSON.parse(rande).brojevi);
let kand = JSON.parse(JSON.parse(rande).izvestaj);
	 let mdd1= document.getElementById("section1");
	  let mdd2= document.getElementById("section2");
	  let mdd3= document.getElementById("section3");
	  let mdd4= document.getElementById("section4");
	let arr =[];

	let x = mdd1.getElementsByClassName('circle');
	let uu = mdd4.getElementsByClassName('xsym');
	let yy = mdd4.getElementsByClassName('esym');
	for (let i=0; i<uu.length;i++){
		uu[i].style.pointerEvents='none';
		let izvestaj = document.createElement('div');
			izvestaj.style.border="1px solid rgba(255, 255, 255, 0.5)";
			izvestaj.style.position="absolute";
			izvestaj.style.bottom='2px';
			izvestaj.style.right='2px';
			izvestaj.style.color='white';
			izvestaj.style.padding='0 0.5em';
			izvestaj.style.fontSize='10px';
			izvestaj.style.borderRadius='4px';
			izvestaj.style.background='red';
			izvestaj.innerHTML = 'odigrano : ' + kand[i].odigrano + ' pogođeno: ' + kand[i].pogodjeno;
		uu[i].parentElement.appendChild(izvestaj);
		yy[i].style.pointerEvents='none';
		uu[i].style.display='none';
		yy[i].style.display='none';
	}
		
		for (let i=0; i<x.length; i++){
		 if(x[i].innerHTML !== ''){
			
			 arr.push(x[i].innerHTML);
		 } 
	 }
	 

	  let xex=mdd3.getElementsByClassName('circleS');
	 for(let i =0;i<xex.length;i++){
		let kezp=rand[i];
	    (function (i,kezp,x) {
			
    setTimeout(function () {
		
		 let novaIgra = document.getElementById("mainButton");
		
			
			novaIgra.setAttribute("style", "pointer-events:none;");
				if(i == 11){
					
					 let novaIgra = document.getElementById("mainButton");
						novaIgra.setAttribute("style", "pointer-events:none;");
						
						     setTimeout(function () { 
							  let novaIgraA = document.createElement("div");
							  novaIgraA.setAttribute('class','button');
							   novaIgraA.setAttribute('id','novoBir');
								novaIgraA.innerHTML = 'Novo biranje';
								novaIgraA.setAttribute("onclick", "bingo.instance.obnoviSablon()");
								
								mdd2.appendChild(novaIgraA);
							 }, 2000);	
		
		

				}
			novaIgra.innerHTML = '<div style="width:100%; float:left; height:84px; line-height:84px;"> Izvlacenje broj: <span class="circle" style="background:green; float:right;">' + (i+1) + '</span></div>';
	
		let novaIgra2 = document.getElementById("mainButton");

			novaIgra2.innerHTML += '<div style="width:100%; float:left; height:84px; line-height:84px;"> Izvucen broj: <span class="circle" style="float:right;">' + rand[i] +'</span></div>';
	



		


		let randz = document.createElement("div");
			randz.setAttribute("class", "circle");
			randz.innerHTML = rand[i];
			
			for (let i=0; i<x.length; i++){

				 if(x[i].innerHTML == kezp){
		
					 x[i].setAttribute('style','background:green; font-weight:900; color:white;');
				 } 
			}
		xex[i].appendChild(randz); 
	
			let xr = document.getElementsByClassName("numbersContainer");
			for (let i=0;i<xr.length; i++){
					var srecko = xr[i].getElementsByClassName('circle');
					
						for(let j =0; j<srecko.length;j++){
					
							if(srecko[j].innerHTML == kezp){
								srecko[j].setAttribute('style','background:green;');
								srecko[j].setAttribute('class','circle srecko');
								
								let provera = document.createElement("span");
									provera.setAttribute("style", "display:none");		
									//today2.instance.proveriSrecka(xr[i]);	
									
							}	
						}	
			}  
	
	}, 1000*i);
  })(i,kezp,x);
		
	 }
	 
				
	
	
	
	
}

izbrisiTiket(me){
	this._iy1--; 
	me.parentElement.style.background ='white';
	me.parentElement.innerHTML='';
	
	let arr =[];
	
	
		
		let button = document.getElementById("mainButton");
			button.innerHTML='Dodaj Tiket';
			button.setAttribute("onclick", "bingo.instance.dodajTiket()");
			button.style.pointerEvents='all';
	
				
	 var x = document.getElementsByClassName("numbersContainer");	
	 
	 for (let i=0; i<x.length; i++){
		 if(x[i].innerHTML !== ''){
			
			 arr.push(x[i].innerHTML);
		 } 
	 }

	 for(let i=0; i<x.length; i++){
		 while (x[i].firstChild) x[i].removeChild(x[i].firstChild);
		 x[i].style.background='white';
	 }
	 for(let i = 0; i<arr.length; i++){
		x[i].innerHTML = arr[i];	
		x[i].style.background='green';
		
	 }
	 
	 }
		
predajTiket() {
	


		if (document.getElementById('editButton')) {
    document.getElementById('editButton').parentNode.removeChild(document.getElementById('editButton'));
	document.getElementById('mainButton').style.display='block';
}
	if (document.getElementById('editField')) {
    document.getElementById('editField').parentNode.removeChild(document.getElementById('editField'));
}
	
let mdd1= document.getElementById("section1");

	if(document.getElementById("editButton")){
				let button = document.getElementById("editButton");
		button.setAttribute('style','display:none');	
		}
	  let x = document.getElementsByClassName("numbersContainer");
	
	for (let i=0;i<x.length; i++){
		if(x[i].innerHTML !== ''){
			
		
		let y= x[this._iy1].getElementsByClassName("circle");
	
		for(let j=0;j<y.length;j++){
			  
			y[j].setAttribute('style',' pointer-events: none;');
				
		
			
			
		}
			

	
			
		

		

		
		}
				
	}

	if(x[this._iy1].getElementsByClassName("circle")[0]){
		if(document.getElementsByClassName("xsym") && document.getElementsByClassName("esym")){
var xsym = document.getElementsByClassName("xsym");
		var esym = document.getElementsByClassName("esym");
			for(let i = 0; i<xsym.length; i++){
				xsym[i].style.pointerEvents='all';
				xsym[i].style.display='block';
				esym[i].style.display='block';
				esym[i].style.pointerEvents='all';
			}
	}
    this._iy1++; 
	document.getElementById('section1').style.pointerEvents='none';
	
	let button = document.getElementById("mainButton");
		button.innerHTML='Dodaj tiket';
		button.setAttribute("onclick", "bingo.instance.dodajTiket()");
		button.style.pointerEvents='all';
		this._iy2 = 0;
		glavniSablon.instance.cleanElement("section1");

		for(let i=0;i<30;i++){
			
			let broj = document.createElement("div");
			broj.setAttribute("class", "circle");
			broj.setAttribute("id", "lotoBroj"+ (i+1) +"");
			broj.setAttribute("onclick", "bingo.instance.dodajBroj(this)");
			broj.innerHTML = i+1;
			
			
			mdd1.appendChild(broj);
			
		}
		
		var xsym = document.getElementsByClassName("xsym");
		var esym = document.getElementsByClassName("esym");
			for(let i = 0; i<xsym.length; i++){
				xsym[i].style.pointerEvents='all';
				xsym[i].style.display='block';
				esym[i].style.display='block';
				esym[i].style.pointerEvents='all';
			}
		
		if(this._iy1 == 5){
				 (function IIFE(){	
			let button = document.getElementById("mainButton");
				button.innerHTML='Zapocni izvlacenje';
				button.setAttribute("onclick", "bingo.instance.odigraj()");
				button.style.pointerEvents='all';
			
				
		
			
			 })();
		}

	}else{
		
	}
	
	 

	
}

napisiSistemKvotaLow() {

	console.log(user);
	
	if(document.getElementById('kestenica')){
		glavniSablon.instance.removeElement('kestenica');
	}
	if(document.getElementById('kokoriceeea')){
		glavniSablon.instance.removeElement('kokoriceeea');
	}
	
	   let bodty= document.getElementById('praviAssideL');	
		let aside = document.createElement("div");
			aside.setAttribute("class", "inner");
			aside.setAttribute("id", "kokoriceeea");
		let naslov = document.createElement("h1");
			naslov.setAttribute("class", "info");	
			naslov.innerHTML='Logged out text zone';
aside.appendChild(naslov);
bodty.appendChild(aside);
}

napisiSistemKvota() {
	if(document.getElementById('kestenica')){
		glavniSablon.instance.removeElement('kestenica');
	}
	if(document.getElementById('kokoriceeea')){
		glavniSablon.instance.removeElement('kokoriceeea');
	}
	   let bodty= document.getElementById('praviAssideL');	
		let aside = document.createElement("div");
			aside.setAttribute("class", "inner");
			aside.setAttribute("id", "kestenica");
			
		let naslov = document.createElement("h1");
			naslov.setAttribute("class", "info");	
			naslov.innerHTML='Sistem izracunavanja kvota:';
			aside.appendChild(naslov)
			
		let olista = document.createElement("ul");
			olista.setAttribute("class", "olista");		
			aside.appendChild(olista)
		
		for( let i=0;i<5;i++){
			let mainLi = document.createElement("li");
				
				mainLi.innerHTML ='Ukupno odigrano brojeva: ' + (i+1) ;
				olista.appendChild(mainLi)
			let malaOl = document.createElement("ol");
				malaOl.setAttribute('class','manlica');
				olista.appendChild(malaOl);
				for(let j=0; j<5;j++){
					
					let uMainLi = document.createElement("li");
						
				
					switch (j) {
								  case 0:
								
									uMainLi.innerHTML='V <span class="verovatnoca">' + this.izracunajVerovatnocu(30,12,(i+1)) + '</span>';
									break;
									case 1:
													
												switch (i) {
													case 0:
														uMainLi.innerHTML='KS: <span class="koeficijentSmanjenja">0.92</span>';
													break;
													
													case 1:
														uMainLi.innerHTML='KS: <span class="koeficijentSmanjenja">0.94</span>';
													break;
													
													case 2:
														uMainLi.innerHTML='KS:<span class="koeficijentSmanjenja">0.96</span>';
													break;	
														
													case 3:
														uMainLi.innerHTML='KS:<span class="koeficijentSmanjenja">0.98</span>';
													break;
													
													case 4:
														uMainLi.innerHTML='KS: <span class="koeficijentSmanjenja">1</span>';
													break;
														
											
								}			
											
									
									break;
									case 2:
									uMainLi.innerHTML='KL:<span class="koeficijentSmanjenjaKvota">0.9</span>';
									break;	
									
									case 3:
										uMainLi.innerHTML='TKV: <span class="tacnaKvota">' + (1/this.izracunajVerovatnocu(30,12,(i+1))) + '</span>';
									break;
									
									case 4:
										(function IIFE(){ 
										setTimeout(function(){ 
										 let kapisla = uMainLi.parentElement.getElementsByClassName('verovatnoca')[0].innerHTML;
										 let kapisla2 = uMainLi.parentElement.getElementsByClassName('koeficijentSmanjenja')[0].innerHTML;
										 let kapisla3= uMainLi.parentElement.getElementsByClassName('koeficijentSmanjenjaKvota')[0].innerHTML;
										uMainLi.innerHTML='KV: <span id="konacnaVrednostKvote">'+(1/kapisla)*kapisla2*kapisla3+'</span>';
									}, 20);
										})();
									break;
										
							
								}
								malaOl.appendChild(uMainLi);
				
					
				
					
				}
				
				
				
					
				let center = document.createElement("div");
				center.setAttribute("class", "center");
				center.setAttribute("id", "center");
				

				
						   
				
				
		}		
			this.racunajKvotee();
			if(document.getElementById('tg-wrap')){
			}
			else{
			let tabela = document.createElement('div')
				tabela.setAttribute('class','tg-wrap');
				tabela.setAttribute('id','tg-wrap');
				tabela.innerHTML='<table class="tg"> <tbody> <tr> <th></th> <th style="background-color:#ffffff;text-align:left;vertical-align:top;">5</th> <th style="padding:4px; font-size:13.5px;background-color:#ffffff;text-align:left;vertical-align:top">4</th> <th style="padding:4px; font-size:13.5px;background-color:#ffffff;text-align:left;vertical-align:top">3</th> <th style="padding:4px; font-size:13.5px;background-color:#ffffff;text-align:left;vertical-align:top">2</th> <th style="padding:4px; font-size:13.5px;background-color:#ffffff;text-align:left;vertical-align:top">1</th> </tr><tr> <td style="padding:4px; font-size:13.5px;border-color:inherit;background-color:#ffffff;text-align:right;vertical-align:top">5</td><td style="padding:4px; font-size:13.5px;border-color:#000000;background-color:#efefef;text-align:center;vertical-align:top;">179.94</td><td style="padding:4px; font-size:13.5px;border-color:#000000;background-color:#efefef;text-align:center;vertical-align:top">35.43</td><td style="padding:4px; font-size:13.5px;border-color:#000000;background-color:#efefef;text-align:center;vertical-align:top">7.33</td><td style="padding:4px; font-size:13.5px;border-color:#000000;background-color:#efefef;text-align:center;vertical-align:top">1.05</td><td style="padding:4px; font-size:13.5px;border-color:#000000;background-color:#efefef;text-align:center;vertical-align:top">0.10</td></tr><tr> <td style="padding:4px; font-size:13.5px;border-color:inherit;background-color:#ffffff;text-align:right;vertical-align:top">4</td><td style="padding:4px; font-size:13.5px;border-color:#000000;background-color:#ffffff;text-align:left;vertical-align:top"></td><td style="padding:4px; font-size:13.5px;border-color:#000000;background-color:#efefef;text-align:center;vertical-align:top">55.36</td><td style="padding:4px; font-size:13.5px;border-color:#000000;background-color:#efefef;text-align:center;vertical-align:top">10.64</td><td style="padding:4px; font-size:13.5px;border-color:#000000;background-color:#efefef;text-align:center;vertical-align:top;">1.64</td><td style="padding:4px; font-size:13.5px;border-color:#000000;background-color:#efefef;text-align:center;vertical-align:top">0.15</td></tr><tr> <td style="padding:4px; font-size:13.5px;border-color:inherit;background-color:#ffffff;text-align:right;vertical-align:top">3</td><td style="padding:4px; font-size:13.5px;border-color:#000000;background-color:#ffffff;text-align:left;vertical-align:top"></td><td style="padding:4px; font-size:13.5px;border-color:#000000;background-color:#ffffff;text-align:left;vertical-align:top"></td><td style="padding:4px; font-size:13.5px;border-color:#000000;background-color:#efefef;text-align:center;vertical-align:top">18.45</td><td style="padding:4px; font-size:13.5px;border-color:#000000;background-color:#efefef;text-align:center;vertical-align:top">2.89</td><td style="padding:4px; font-size:13.5px;border-color:#000000;background-color:#efefef;text-align:center;vertical-align:top">0.27</td></tr><tr> <td style="padding:4px; font-size:13.5px;border-color:inherit;background-color:#ffffff;text-align:right;vertical-align:top">2</td><td style="padding:4px; font-size:13.5px;border-color:#000000;background-color:#ffffff;text-align:left;vertical-align:top"></td><td style="padding:4px; font-size:13.5px;border-color:#000000;background-color:#ffffff;text-align:left;vertical-align:top"></td><td style="padding:4px; font-size:13.5px;border-color:#000000;background-color:#ffffff;text-align:left;vertical-align:top"></td><td style="padding:4px; font-size:13.5px;border-color:#000000;background-color:#efefef;text-align:center;vertical-align:top">6.59</td><td style="padding:4px; font-size:13.5px;border-color:#000000;background-color:#efefef;text-align:center;vertical-align:top">0.62</td></tr><tr> <td style="padding:4px; font-size:13.5px;border-color:inherit;background-color:#ffffff;text-align:right;vertical-align:top">1</td><td style="padding:4px; font-size:13.5px;border-color:#000000;background-color:#ffffff;text-align:left;vertical-align:top"></td><td style="padding:4px; font-size:13.5px;border-color:#000000;background-color:#ffffff;text-align:left;vertical-align:top"></td><td style="padding:4px; font-size:13.5px;border-color:#000000;background-color:#ffffff;text-align:left;vertical-align:top"></td><td style="padding:4px; font-size:13.5px;border-color:#000000;background-color:#ffffff;text-align:left;vertical-align:top"></td><td style="padding:4px; font-size:13.5px;border-color:#000000;background-color:#efefef;text-align:center;vertical-align:top">2.5</td></tr></tbody></table>';
			
			bodty.appendChild(tabela);
				
			}
			
  }

racunajKvotee() {
	
		
		

	var arr = Array.prototype.slice.call( document.getElementsByClassName('manlica') )
	console.log(arr);
	


		
				let konacnaKvota= document.getElementById('konacnaVrednostKvote');	
				let koeficijentSmanjenjaKvota= document.getElementById('koeficijentSmanjenjaKvota');	
				let koeficijentSmanjenja= document.getElementById('koeficijentSmanjenja');	
				let verovatnoca= document.getElementById('verovatnoca');
				console.log(verovatnoca);
				
		
	}
	
factorialize(num) {

var result = num;
  if (num === 0 || num === 1) 
    return 1; 
  while (num > 1) { 
    num--;
    result *= num;
  }
  return result;
}

izracunajVerovatnocu(z,n,w) {
		
		return(this.factorialize(z-w)*this.factorialize(n))/(this.factorialize(z)*(this.factorialize(n-w)));
		
	}

napraviSablon(iy1,iy2) {

   let bodty= document.getElementById('body');	

		

			
   if(document.getElementById('center')){
      var center= document.getElementById('center');
	  glavniSablon.instance.cleanElement("center");
	}else{
		var center = document.createElement("div");
			center.setAttribute("class", "center");
			center.setAttribute("id", "center");

	}


let left = document.createElement("div");
left.setAttribute("class", "left");

let section3 = document.createElement("div");
section3.setAttribute("class", "inner");
section3.setAttribute("id", "section3");

for(let i =0; i<12; i++){
let circleS = document.createElement("div");
circleS.setAttribute("class", "circleS");
circleS.setAttribute("style", "pointer-events:none;");
section3.appendChild(circleS);
}
let section4 = document.createElement("div");
section4.setAttribute("class", "inner");
section4.setAttribute("id", "section4");





for(let i = 0; i<5;i++){
			(function IIFE(){ 
			let numbersContainer = document.createElement("div");
numbersContainer.setAttribute("class", "numbersContainer");
	section4.appendChild(numbersContainer);
	})();
}
left.appendChild(section3);
left.appendChild(section4);

let right = document.createElement("div");
right.setAttribute("class", "right");

let section1 = document.createElement("div");
section1.setAttribute("class", "inner");
section1.setAttribute("id", "section1");

for(let i = 0; i<30; i++){
let broj = document.createElement("div");
	broj.setAttribute("class", "circle");
	broj.setAttribute("id", "lotoBroj"+ (i+1) +"");
	broj.setAttribute("onclick", "bingo.instance.dodajBroj(this)");
	broj.innerHTML = i+1;
	
	
	section1.appendChild(broj);
}

let section2 = document.createElement("div");
section2.setAttribute("class", "inner");
section2.setAttribute("id", "section2");

let button = document.createElement("div");
	button.setAttribute("class", "button");
	button.setAttribute("id", "mainButton");
	button.innerHTML = 'Dodaj tiket';
	button.setAttribute("onclick", "bingo.instance.dodajTiket()");
	section2.appendChild(button);


right.appendChild(section1);
right.appendChild(section2);

center.appendChild(left);
center.appendChild(right);

			


  }
  
}
class TokenController {

constructor() {



		

  }

napraviToken(microtime,stranica,korisnik){
	
	 forntCommController.instance.posaljiServeru('napraviToken',microtime,stranica,korisnik);
	 
 }

proveriToken(korisnik,token,stranicaa,nivoPristupa){
	console.log('jebacina 123 : ' + nivoPristupa);
	forntCommController.instance.posaljiServeru('proveriToken',korisnik,token,stranicaa,nivoPristupa);
}
}
class PageController {

constructor() {


	
		this.napraviGlavnuStranicu();
		
	
  }

inicijalizujStranicu(){

	 	let useree=cookieController.instance.getCookie("documentCookie");
		console.log(useree);
	let d = new Date();
		let n = d.getMilliseconds();
			let stranica = user.instance.stranica;
		let korisnik = user.instance.korisnik;
		  
		  if(user.instance.logovan === 'da'){
				  
				  tokenController.instance.napraviToken(n,stranica,user.instance.korisnik);
				  
				    
		  }else{
	
			     this.pomocnikInicijalizacije();
		  }
		  
		console.log('kuraca');

		  
					
	
}
pomocnikInicijalizacije(){
	let stranica = user.instance.stranica;
	
		switch (stranica) {
			
			  case 'bingo':
					bingo.instance = new BingoTiketSistem(0, 0);
					 
					url.instance.push_state(stranica, 'Bingo | Blazing Sun','https://blazingsun.space/bingo');
					eventController.instance.pageChangeRemoveEvent(stranica);
				break;
				
			  case 'naslovna':
					homepage.instance = new Homepage();
					eventController.instance.pageChangeRemoveEvent(stranica);
					url.instance.push_state(stranica, 'Naslovna | Blazing Sun','https://blazingsun.space/naslovna');
				break;
				
			case 'privacy-policy':
					privacyPolicy.instance = new PrivacyPolicy();
					eventController.instance.pageChangeRemoveEvent(stranica);
					url.instance.push_state(stranica, 'Privacy Policy | Blazing Sun','https://blazingsun.space/privacy-policy');
				break;	
		}
	
	
}
napraviGlavnuStranicu(){
	
	user.instance.stranica='naslovna';
	user.instance.adresa='https://blazingsun.space/naslovna';
	user.instance.naslov='Naslovna | Blazing Sun';
	document.title = 'Naslovna | Blazing Sun';
		this.inicijalizujStranicu();
		
		
  }

napraviBingoStranicu(){
	
	user.instance.stranica='bingo';
	user.instance.adresa='https://blazingsun.space/bingo';
	user.instance.naslov='Bingo | Blazing Sun';
	document.title = 'Bingo | Blazing Sun';
		this.inicijalizujStranicu();		
		  
}


napraviPrivacyPolicyStranicu(){
	
	user.instance.stranica='privacy-policy';
	user.instance.adresa='https://blazingsun.space/privac-policy';
	user.instance.naslov='Privacy Policy | Blazing Sun';
	document.title = 'Privacy Policy | Blazing Sun';
		this.inicijalizujStranicu();
		
		
  }
  }
class CookieController {

constructor(cname, exdays) {
	
	let user=this.getCookie("documentCookie");

	this.setCookie(cname,user,exdays);
	
 }	
 
setCookie(cname,cvalue,exdays) {
  var d = new Date();
  d.setTime(d.getTime() + (exdays*24*60*60*1000));
  var expires = "expires=" + d.toGMTString();

  document.cookie = cname + "=" + cvalue + ";" + expires + ";" + ";path=/";
}

getCookie(cname) {
  var name = cname + "=";
  var decodedCookie = decodeURIComponent(document.cookie);
  var ca = decodedCookie.split(';');
  for(var i = 0; i < ca.length; i++) {
    var c = ca[i];
    while (c.charAt(0) == ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      return c.substring(name.length, c.length);
    }
  }
  return "";
}

checkCookie(paras,pokazivac) {
  var user=this.getCookie(pokazivac);
  if (user != "") {
   //alert("Welcome again " + user);
   let useresss = paras;
   console.log('ovo su useres paras jebaci: '+ useresss);
	let obiz = JSON.parse(useresss);
		console.log(obiz);
	 tokenController.instance.proveriToken(obiz.korisnik,obiz.token,obiz.stranica,obiz.nivopristupa);
	 
	
	 

	 
	
  } else {
	  
				

				user = '{"korisnik":"gost","nivopristupa":"0", "logovan":"ne","stranica":"naslovna","adresa":"https://blazingsun.space/naslovna","token":"01234567899876543210"}';
			
			

   console.log('Gost user je postavljen');
  


  }
}
}



class BuildController {
	
constructor() {
   document.brojacHelpIme = 0;
	document.brojacHelpEmail = 0;
	document.brojacHelpPass = 0;
 
	document.brojacHelpImeLog =0;
	document.brojacHelpPassLog =0;
 
	
    this._stars = [];
   	this._centerX = 0; 
	this._centerY = 0;
	
	this.napraviGlavniSablon();
	this.napuniHeader();
	this.napuniFooter();
	




	
	
	this.napraviFrontControlerComunicationPolje();
		
		if(user.instance.isLoggedIn()){
			
		}else{
			this.napraviLogReg();
		}

				var xzy = window.location.href;
				
 if (xzy.indexOf("/?aktivirajNalog=") >= 0) {
			console.log('testarica');
		

 }



  }

napraviGlavniSablon(){
	
	

	
	    let body = document.getElementById("body");
	
		let canvasss = document.createElement('canvas');
			canvasss.setAttribute('width','1920');
			canvasss.setAttribute('height','1080');
			canvasss.setAttribute('id','canvasss');
	
			body.appendChild(canvasss);
			
	   let  glavniCont = document.createElement("div");
			glavniCont.setAttribute('class','glavniCont');
			glavniCont.setAttribute('id','glavniCont');
		
	   let  header = document.createElement("header");
			header.setAttribute('id','header');
			glavniCont.appendChild(header);
			
		
			
			let praviAssideL=document.createElement('aside');	
				praviAssideL.setAttribute('id','praviAssideL');	
				praviAssideL.setAttribute('class','inner');
			
			glavniCont.appendChild(praviAssideL);
			
		
		



		

		
		
		
		
 


	let  center = document.createElement("div");
			center.setAttribute('class','center');
			center.setAttribute('id','center');
			glavniCont.appendChild(center);		

			
		
			let asideR = document.createElement("div");
			asideR.setAttribute("id", "assideR");
			asideR.setAttribute("class", "inner");
	
	let asideR2 = document.createElement("div");
			asideR2.setAttribute("id", "assideR2");
			asideR2.setAttribute("class", "inner");
			
			asideR2.style.display ='block';
	let asideR3=document.createElement('div');
		asideR3.setAttribute('id','assideR3');

		
		
		
		
			 let svemirDiv = document.createElement("div");
			svemirDiv.setAttribute('class','loginDiv');
		
			svemirDiv.setAttribute('id','svemirCreate');
			svemirDiv.style.width='100%';
			svemirDiv.innerHTML='Svemir';	
			asideR3.appendChild(svemirDiv);	
		
		
		
			let praviAssideR=document.createElement('aside');	
				praviAssideR.setAttribute('id','praviAssideR');	
				praviAssideR.setAttribute('class','inner');



			praviAssideR.appendChild(asideR);
			praviAssideR.appendChild(asideR2);
			praviAssideR.appendChild(asideR3);
			glavniCont.appendChild(praviAssideR);
	
			
			
	let  footer = document.createElement("div");
			footer.setAttribute('class','footer');
			footer.setAttribute('id','footer');
				
	
  
	
			
		glavniCont.appendChild(footer);		
	  body.appendChild(glavniCont);		
	  
	  
	  eventController.instance.svemirPageShow(); 
	  
  }

napuniFooter(){
	  	let footer = document.getElementById('footer');	
	let footerContent= document.createElement('p');
		footerContent.innerHTML='Blazing Sun 2019. Sva prava zadržana.';

	footer.appendChild(footerContent);
  }

napuniHeader(){
			let header = document.getElementById('header');	
		let homepage= document.createElement('div');
		homepage.setAttribute('id','homeStranica');
		//homepage.setAttribute('onclick','page.instance.napraviGlavnuStranicu()');
	
	
		
		let logoh1= document.createElement('img');
			logoh1.setAttribute('style','height:4em');
			logoh1.setAttribute('src','https://blazingsun.space/assets/images/blazingSun.gif'); 
			logoh1.innerHTML='Naslovna strana';
		homepage.appendChild(logoh1);
		header.appendChild(homepage);
			
			let bingo= document.createElement('div');
				bingo.setAttribute('class','menuItem');

		let logoh1b= document.createElement('h1');
			logoh1b.setAttribute('class','logoh1');
			logoh1b.setAttribute('id','bingoStranica');
		//logoh1b.setAttribute('onclick','page.instance.napraviBingoStranicu()'); 
		logoh1b.innerHTML='Bingo';
		

	
		bingo.appendChild(logoh1b);
			header.appendChild(bingo);
		
			let privacyPolicy= document.createElement('div');
				privacyPolicy.setAttribute('class','menuItem');
		
		let logoh2b= document.createElement('h1');
			logoh2b.setAttribute('class','logoh1');
			logoh2b.setAttribute('id','privacyPolicyStranica');
			//logoh1b.setAttribute('onclick','page.instance.napraviBingoStranicu()'); 
			logoh2b.innerHTML='Privacy Policy';	
		
			privacyPolicy.appendChild(logoh2b);
			header.appendChild(privacyPolicy);
		
		eventController.instance.pageChangeEvents();	
	}


napraviLogReg(){
	 let aside = document.getElementById('assideR');
	 let loginDiv = document.createElement("div");
			loginDiv.setAttribute('class','loginDiv');
			loginDiv.setAttribute('id','loginDiv');
		
			loginDiv.innerHTML='Log in';
	  let loginDivCont = document.createElement("div");
			loginDivCont.setAttribute('class','loginDiv');
			loginDivCont.setAttribute('id','loginDivCont');
		 let loginDivCont2 = document.createElement("div");
			loginDivCont2.setAttribute('class','loginDiv');
			loginDivCont2.setAttribute('id','loginDivCont2');
			
			
			aside.appendChild(loginDiv);
			
	 let regDiv = document.createElement("div");
			regDiv.setAttribute('class','regDiv');
		
			regDiv.setAttribute('id','regDiv');
			regDiv.innerHTML='Registracija';
		
	

	  let regDivCont = document.createElement("div");
			regDivCont.setAttribute('class','regDiv');
			regDivCont.setAttribute('id','regDivCont');	
		  let regDivCont2 = document.createElement("div");
			regDivCont2.setAttribute('class','regDiv');
			regDivCont2.setAttribute('id','regDivCont2');		
			
			aside.appendChild(regDiv);	
			
		
		 let regDivContUpper = document.createElement("div");	
			regDivContUpper.setAttribute('class','regDivContUpper');
			regDivContUpper.setAttribute('id','regDivContUpper');	
		
			regDivContUpper.appendChild(loginDivCont);	
				
			regDivContUpper.appendChild(regDivCont);
				aside.appendChild(regDivContUpper);	
				
			let regDivContBottom = document.createElement("div");	
			regDivContBottom.setAttribute('class','regDivContBottom');
			regDivContBottom.setAttribute('id','regDivContBottom');	
			
				regDivContBottom.appendChild(loginDivCont2);
				regDivContBottom.appendChild(regDivCont2);
				
				aside.appendChild(regDivContBottom);
				
				eventController.instance.logRegEvents();
				
 } 

napraviLogSablon(){


	
	let aside = document.getElementById('assideR');
		let formz = document.createElement("div");
			formz.setAttribute("id", "formLog");
	
			
		let fieldset = document.createElement("fieldset");
			fieldset.setAttribute('id','fieldsetLog');
			
			let legendl = document.createElement("legend");
			
		    legendl.innerHTML='Log in (sva polja su obavezna)';
			fieldset.appendChild(legendl);
		let inputH = document.createElement("input");
			inputH.setAttribute('type','hidden');
			inputH.setAttribute('name','pokazivacLog');
			inputH.setAttribute('id','pokazivacLog');
			inputH.setAttribute('value','log');
			fieldset.appendChild(inputH);	
		let labelK = document.createElement("label");
			labelK.setAttribute('for','usernameLog');
			labelK.innerHTML='Korisnicko ime: <span class="obavezno">*</span>';
			fieldset.appendChild(labelK);
		let inputU = document.createElement("input");
			inputU.setAttribute('type','text');
			inputU.setAttribute('placeholder','Korisnicko ime');
			inputU.setAttribute('pattern','.{6,32}');
			inputU.setAttribute('name','usernameLog');
			inputU.setAttribute('id','usernameLog');
			inputU.setAttribute('required','');
			inputU.setAttribute('title','Minimum 6 karaktera, maksimum 32.');
			fieldset.appendChild(inputU);
		let labelK2 = document.createElement("label");
			labelK2.setAttribute('for','usernameLog');
			labelK2.setAttribute('id','usernameLogLog2');
			labelK2.innerHTML='';
			fieldset.appendChild(labelK2);	
		let labelP = document.createElement("label");
			labelP.setAttribute('for','passwordLog');
			labelP.innerHTML='Password: <span class="obavezno">*</span>';
			fieldset.appendChild(labelP);
		let inputP = document.createElement("input");
			inputP.setAttribute('type','password');
			inputP.setAttribute('placeholder','Password');
			inputP.setAttribute('pattern','.{6,32}');
			inputP.setAttribute('name','passwordLog');
			inputP.setAttribute('id','passwordLog');
			inputP.setAttribute('required','');
			inputP.setAttribute('title','Minimum 6 karaktera, maksimum 32.');
	fieldset.appendChild(inputP);
	

			formz.appendChild(fieldset);
			
			
			let loginCont= document.getElementById('loginDivCont');	
			loginCont.appendChild(formz);
			aside.appendChild(loginCont);
		
	

}

napraviRegSablon(){

	
	let aside = document.getElementById('assideR');
		let formz = document.createElement("div");
			formz.setAttribute("id", "formReg");
	
			
		let fieldset = document.createElement("fieldset");
			fieldset.setAttribute('id','fieldsetReg');
		let legend = document.createElement("legend");
			legend.innerHTML='Registracija (sva polja su obavezna)';
			fieldset.appendChild(legend);
		let inputH = document.createElement("input");
			inputH.setAttribute('type','hidden');
			inputH.setAttribute('name','pokazivacReg');
			inputH.setAttribute('id','pokazivacReg');
			inputH.setAttribute('value','reg');
			fieldset.appendChild(inputH);
		let labelK = document.createElement("label");
			labelK.setAttribute('for','usernameReg');
			labelK.innerHTML='Korisnicko ime: <span class="obavezno">*</span>';
			fieldset.appendChild(labelK);
		let inputU = document.createElement("input");
			inputU.setAttribute('type','text');
			inputU.setAttribute('placeholder','Korisnicko ime (6 - 32 karaktera)');
			inputU.setAttribute('pattern','.{6,32}');
			inputU.setAttribute('name','usernameReg');
			inputU.setAttribute('id','usernameReg');
			inputU.setAttribute('required','');
			inputU.setAttribute('title','Minimum 6 karaktera, maksimum 32.');
			fieldset.appendChild(inputU);
		let labelK2 = document.createElement("label");
			labelK2.setAttribute('for','usernameReg');
			labelK2.setAttribute('id','usernameRegLabDown');
			fieldset.appendChild(labelK2);	
		let labelE = document.createElement("label");
			labelE.setAttribute('for','email');
			labelE.innerHTML='Email: <span class="obavezno">*</span>';
			fieldset.appendChild(labelE);
		let inputE = document.createElement("input");
			inputE.setAttribute('type','email');
			inputE.setAttribute('placeholder','Email (max 64 karaktera)');
			inputE.setAttribute('size','64');
			inputE.setAttribute('name','email');
			inputE.setAttribute('id','email');
			inputE.setAttribute('required','');
			inputE.setAttribute('title','Email (max 64 karaktera)');
			fieldset.appendChild(inputE);
		let labelE2 = document.createElement("label");
			labelE2.setAttribute('for','email');
			labelE2.setAttribute('id','emailRegLabDown');
			fieldset.appendChild(labelE2);	
		let labelP = document.createElement("label");
			labelP.setAttribute('for','passwordReg');
			labelP.innerHTML='Password: <span class="obavezno">*</span>';
			fieldset.appendChild(labelP);
		let inputP = document.createElement("input");
			inputP.setAttribute('type','password');
			inputP.setAttribute('placeholder','Password (6 - 32 karaktera)');
			inputP.setAttribute('pattern','.{6,32}');
			inputP.setAttribute('name','passwordReg');
			inputP.setAttribute('id','passwordReg');
			inputP.setAttribute('required','');
			inputP.setAttribute('title','Minimum 6 karaktera, maksimum 32.');
			fieldset.appendChild(inputP);
		let labelPP = document.createElement("label");
			labelPP.setAttribute('for','confirm_password');
			labelPP.innerHTML='Ponovite password: <span class="obavezno">*</span>';
			fieldset.appendChild(labelPP);	
		let inputPP = document.createElement("input");
			inputPP.setAttribute('type','password');
			inputPP.setAttribute('placeholder','Potvrdite password');
			inputPP.setAttribute('pattern','.{6,32}');
			inputPP.setAttribute('name','confirm_password');
			inputPP.setAttribute('id','confirm_password');
			inputPP.setAttribute('required','');
			inputPP.setAttribute('title','Minimum 6 karaktera, maksimum 32.');
			fieldset.appendChild(inputPP);	
		let labelPP2 = document.createElement("label");
			labelPP2.setAttribute('for','confirm_password');
			labelPP2.setAttribute('id','confirm_password_downLab');
			fieldset.appendChild(labelPP2);	
		

			formz.appendChild(fieldset);
		let regCont= document.getElementById('regDivCont');	
			regCont.appendChild(formz);
			aside.appendChild(regCont);
			

			
		
			
			}

cleanElement(elementId){
	var element = document.getElementById(elementId);
	while (element.firstChild) element.removeChild(element.firstChild);
}

removeElement(elementId) {
    // Removes an element from the document
    var element = document.getElementById(elementId);
    element.parentNode.removeChild(element);
}

napraviPrivacyPolicySablon(){  

	glavniSablon.instance.cleanElement('center');	
		 let center= document.getElementById('center');
		
		let element=document.createElement('div');
		let element2=document.createElement('div');
				element2.innerHTML='<div id="ppBody"><div style="font-family: verdana; font-size: 21pt; width:auto; margin: 0px auto; color: rgb(255, 255, 247); font-style: normal; font-variant-ligatures: normal; font-variant-caps: normal; font-weight: 400; letter-spacing: normal; orphans: 2; text-align: start; text-indent: 0px; text-transform: none; white-space: normal; widows: 2; word-spacing: 0px; -webkit-text-stroke-width: 0px; text-decoration-style: initial; text-decoration-color: initial;"><span style="color: rgb(250, 197, 28);">Privacy Policy</span></div><div style="font-size: 11pt; width: auto; margin: 0px auto; text-align: justify; color: rgb(255, 255, 247); font-family: Roboto, sans-serif; font-style: normal; font-variant-ligatures: normal; font-variant-caps: normal; font-weight: 400; letter-spacing: normal; orphans: 2; text-indent: 0px; text-transform: none; white-space: normal; widows: 2; word-spacing: 0px; -webkit-text-stroke-width: 0px; text-decoration-style: initial; text-decoration-color: initial;"> <div style="clear: both; height: 10px;"><span style="color: rgb(250, 197, 28);"><br></span></div><div style="clear: both; height: 10px;"><span style="color: rgb(250, 197, 28);"><br></span></div><div class="innerText"><span style="color: rgb(250, 197, 28);">This privacy policy has been compiled to better serve those who are concerned with how their &#39;Personally Identifiable Information&#39; (PII) is being used online. PII, as described in US privacy law and information security, is information that can be used on its own or with other information to identify, contact, or locate a single person, or to identify an individual in context. Please read our privacy policy carefully to get a clear understanding of how we collect, use, protect or otherwise handle your Personally Identifiable Information in accordance with our website.</span></div><div class="grayText"><span style="color: rgb(250, 197, 28);"><strong>What personal information do we collect from the people that visit our blog, website or app?</strong></span></div><div class="innerText"><span style="color: rgb(250, 197, 28);">When ordering or registering on our site, as appropriate, you may be asked to enter your name, email address or other details to help you with your experience.</span></div><div class="grayText"><span style="color: rgb(250, 197, 28);"><strong>When do we collect information?</strong></span></div><div class="innerText"><span style="color: rgb(250, 197, 28);">We collect information from you when you subscribe to a newsletter, fill out a form or enter information on our site.</span></div><span style="color: rgb(250, 197, 28);"><br></span> <div class="grayText"><span style="color: rgb(250, 197, 28);"><strong>How do we use your information?</strong></span></div><div class="innerText"><span style="color: rgb(250, 197, 28);">We may use the information we collect from you when you register, make a purchase, sign up for our newsletter, respond to a survey or marketing communication, surf the website, or use certain other site features in the following ways:<br><br></span></div><div class="innerText"><span style="color: rgb(250, 197, 28);">&nbsp; &nbsp; &nbsp;&nbsp;<strong>&bull;</strong> To personalize your experience and to allow us to deliver the type of content and product offerings in which you are most interested.</span></div><div class="innerText"><span style="color: rgb(250, 197, 28);">&nbsp; &nbsp; &nbsp;&nbsp;<strong>&bull;</strong> To improve our website in order to better serve you.</span></div><div class="innerText"><span style="color: rgb(250, 197, 28);">&nbsp; &nbsp; &nbsp;&nbsp;<strong>&bull;</strong> To allow us to better service you in responding to your customer service requests.</span></div><div class="grayText"><span style="color: rgb(250, 197, 28);"><strong>How do we protect your information?</strong></span></div><div class="innerText"><span style="color: rgb(250, 197, 28);">We do not use vulnerability scanning and/or scanning to PCI standards.</span></div><div class="innerText"><span style="color: rgb(250, 197, 28);">We only provide articles and information. We never ask for credit card numbers.</span></div><div class="innerText"><span style="color: rgb(250, 197, 28);">We use regular Malware Scanning.<br><br></span></div><div class="innerText"><span style="color: rgb(250, 197, 28);">Your personal information is contained behind secured networks and is only accessible by a limited number of persons who have special access rights to such systems, and are required to keep the information confidential. In addition, all sensitive/credit information you supply is encrypted via Secure Socket Layer (SSL) technology.</span></div><div class="innerText"><span style="color: rgb(250, 197, 28);">We implement a variety of security measures when a user places an order enters, submits, or accesses their information to maintain the safety of your personal information.</span></div><div class="innerText"><span style="color: rgb(250, 197, 28);">All transactions are processed through a gateway provider and are not stored or processed on our servers.</span></div><div class="grayText"><span style="color: rgb(250, 197, 28);"><strong>Do we use &#39;cookies&#39;?</strong></span></div><div class="innerText"><span style="color: rgb(250, 197, 28);">We do not use cookies for tracking purposes</span></div><div class="innerText"><span style="color: rgb(250, 197, 28);"><br>You can choose to have your computer warn you each time a cookie is being sent, or you can choose to turn off all cookies. You do this through your browser settings. Since browser is a little different, look at your browser&#39;s Help Menu to learn the correct way to modify your cookies.</span></div><div class="innerText"><span style="color: rgb(250, 197, 28);">If you turn cookies off, Some of the features that make your site experience more efficient may not function properly.that make your site experience more efficient and may not function properly.</span></div><span style="color: rgb(250, 197, 28);"><br></span> <div class="grayText"><span style="color: rgb(250, 197, 28);"><strong>Third-party disclosure</strong></span></div><div class="innerText"><span style="color: rgb(250, 197, 28);">We do not sell, trade, or otherwise transfer to outside parties your Personally Identifiable Information unless we provide users with advance notice. This does not include website hosting partners and other parties who assist us in operating our website, conducting our business, or serving our users, so long as those parties agree to keep this information confidential. We may also release information when it&#39;s release is appropriate to comply with the law, enforce our site policies, or protect ours or others&#39; rights, property or safety.<br><br>However, non-personally identifiable visitor information may be provided to other parties for marketing, advertising, or other uses.</span></div><div class="grayText"><span style="color: rgb(250, 197, 28);"><strong>Third-party links</strong></span></div><div class="innerText"><span style="color: rgb(250, 197, 28);">Occasionally, at our discretion, we may include or offer third-party products or services on our website. These third-party sites have separate and independent privacy policies. We therefore have no responsibility or liability for the content and activities of these linked sites. Nonetheless, we seek to protect the integrity of our site and welcome any feedback about these sites.</span></div><div class="blueText"><span style="color: rgb(250, 197, 28);"><strong>Google</strong></span></div><div class="innerText"><span style="color: rgb(250, 197, 28);">Google&#39;s advertising requirements can be summed up by Google&#39;s Advertising Principles. They are put in place to provide a positive experience for users. https://support.google.com/adwordspolicy/answer/1316548?hl=en<br><br></span></div><div class="innerText"><span style="color: rgb(250, 197, 28);">We use Google AdSense Advertising on our website.</span></div><div class="innerText"><span style="color: rgb(250, 197, 28);"><br>Google, as a third-party vendor, uses cookies to serve ads on our site. Google&#39;s use of the DART cookie enables it to serve ads to our users based on previous visits to our site and other sites on the Internet. Users may opt-out of the use of the DART cookie by visiting the Google Ad and Content Network privacy policy.</span></div><div class="innerText"><span style="color: rgb(250, 197, 28);"><br><strong>We have implemented the following:</strong></span></div><div class="innerText"><span style="color: rgb(250, 197, 28);">We, along with third-party vendors such as Google use first-party cookies (such as the Google Analytics cookies) and third-party cookies (such as the DoubleClick cookie) or other third-party identifiers together to compile data regarding user interactions with ad impressions and other ad service functions as they relate to our website.</span></div><div class="innerText"><span style="color: rgb(250, 197, 28);"><br><strong>Opting out:</strong><br>Users can set preferences for how Google advertises to you using the Google Ad Settings page. Alternatively, you can opt out by visiting the Network Advertising Initiative Opt Out page or by using the Google Analytics Opt Out Browser add on.</span></div><div class="blueText"><span style="color: rgb(250, 197, 28);"><strong>California Online Privacy Protection Act</strong></span></div><div class="innerText"><span style="color: rgb(250, 197, 28);">CalOPPA is the first state law in the nation to require commercial websites and online services to post a privacy policy. The law&#39;s reach stretches well beyond California to require any person or company in the United States (and conceivably the world) that operates websites collecting Personally Identifiable Information from California consumers to post a conspicuous privacy policy on its website stating exactly the information being collected and those individuals or companies with whom it is being shared. - See more at: http://consumercal.org/california-online-privacy-protection-act-caloppa/#sthash.0FdRbT51.dpuf</span></div><div class="innerText"><span style="color: rgb(250, 197, 28);"><br><strong>According to CalOPPA, we agree to the following:</strong></span></div><div class="innerText"><span style="color: rgb(250, 197, 28);">Users can visit our site anonymously.</span></div><div class="innerText"><span style="color: rgb(250, 197, 28);">Once this privacy policy is created, we will add a link to it on our home page or as a minimum, on the first significant page after entering our website.<br></span></div><div class="innerText"><span style="color: rgb(250, 197, 28);">Our Privacy Policy link includes the word &#39;Privacy&#39; and can easily be found on the page specified above.</span></div><div class="innerText"><span style="color: rgb(250, 197, 28);"><br>You will be notified of any Privacy Policy changes:</span></div><div class="innerText"><span style="color: rgb(250, 197, 28);">&nbsp; &nbsp; &nbsp;&nbsp;<strong>&bull;</strong> On our Privacy Policy Page</span></div><div class="innerText"><span style="color: rgb(250, 197, 28);">Can change your personal information:</span></div><div class="innerText"><span style="color: rgb(250, 197, 28);">&nbsp; &nbsp; &nbsp;&nbsp;<strong>&bull;</strong> By emailing us</span></div><div class="innerText"><span style="color: rgb(250, 197, 28);"><br><strong>How does our site handle Do Not Track signals?</strong></span></div><div class="innerText"><span style="color: rgb(250, 197, 28);">We honor Do Not Track signals and Do Not Track, plant cookies, or use advertising when a Do Not Track (DNT) browser mechanism is in place.</span></div><div class="innerText"><span style="color: rgb(250, 197, 28);"><br><strong>Does our site allow third-party behavioral tracking?</strong></span></div><div class="innerText"><span style="color: rgb(250, 197, 28);">It&#39;s also important to note that we allow third-party behavioral tracking</span></div><div class="blueText"><span style="color: rgb(250, 197, 28);"><strong>COPPA (Children Online Privacy Protection Act)</strong></span></div><div class="innerText"><span style="color: rgb(250, 197, 28);">When it comes to the collection of personal information from children under the age of 13 years old, the Children&#39;s Online Privacy Protection Act (COPPA) puts parents in control. The Federal Trade Commission, United States&#39; consumer protection agency, enforces the COPPA Rule, which spells out what operators of websites and online services must do to protect children&#39;s privacy and safety online.<br><br></span></div><div class="innerText"><span style="color: rgb(250, 197, 28);">We do not specifically market to children under the age of 13 years old.</span></div><div class="innerText"><span style="color: rgb(250, 197, 28);">Do we let third-parties, including ad networks or plug-ins collect PII from children under 13?</span></div><div class="blueText"><span style="color: rgb(250, 197, 28);"><strong>Fair Information Practices</strong></span></div><div class="innerText"><span style="color: rgb(250, 197, 28);">The Fair Information Practices Principles form the backbone of privacy law in the United States and the concepts they include have played a significant role in the development of data protection laws around the globe. Understanding the Fair Information Practice Principles and how they should be implemented is critical to comply with the various privacy laws that protect personal information.<br><br></span></div><div class="innerText"><span style="color: rgb(250, 197, 28);"><strong>In order to be in line with Fair Information Practices we will take the following responsive action, should a data breach occur:</strong></span></div><div class="innerText"><span style="color: rgb(250, 197, 28);">We will notify you via email</span></div><div class="innerText"><span style="color: rgb(250, 197, 28);">&nbsp; &nbsp; &nbsp;&nbsp;<strong>&bull;</strong> Within 1 business day</span></div><div class="innerText"><span style="color: rgb(250, 197, 28);">We will notify the users via in-site notification</span></div><div class="innerText"><span style="color: rgb(250, 197, 28);">&nbsp; &nbsp; &nbsp;&nbsp;<strong>&bull;</strong> Within 1 business day</span></div><div class="innerText"><span style="color: rgb(250, 197, 28);"><br>We also agree to the Individual Redress Principle which requires that individuals have the right to legally pursue enforceable rights against data collectors and processors who fail to adhere to the law. This principle requires not only that individuals have enforceable rights against data users, but also that individuals have recourse to courts or government agencies to investigate and/or prosecute non-compliance by data processors.</span></div></div></div>';
		
		element.appendChild(element2);
		center.appendChild(element);

}

napraviHomeSablon(){
	 	if(document.getElementById('kestenica')){
		glavniSablon.instance.removeElement('kestenica');
	}
	if(document.getElementById('kokoriceeea')){
		glavniSablon.instance.removeElement('kokoriceeea');
	}
		glavniSablon.instance.cleanElement('center');	
		 let center= document.getElementById('center');
		
		let element=document.createElement('div');
		let element2=document.createElement('div');
		element2.innerHTML='<table style="width:100%"><tbody><tr><td width="10" style="padding:7px 0">&nbsp;</td><td style="padding:7px 0"><font size="2" face="Open-sans, sans-serif" color="#555454"><p style="border-bottom:1px solid #d6d4d4;margin:3px 0 7px;text-transform:uppercase;font-weight:500;font-size:18px;padding-bottom:10px">O meni</p><span style="color:#777"><span style="font-weight:bold">Milorad</span> <span style="font-weight:bold">Djukovic</span><br>NH Svete Popovica 24<br>32300 Gornji Milanovac<br>Serbia<br>+381629616231<br></span></font></td><td width="10" style="padding:7px 0">&nbsp;</td></tr></tbody></table>';
			element.appendChild(element2);
		center.appendChild(element);
  }
  
napraviHomePremiumSablon(){
	 	if(document.getElementById('kestenica')){
		glavniSablon.instance.removeElement('kestenica');
	}
	if(document.getElementById('kokoriceeea')){
		glavniSablon.instance.removeElement('kokoriceeea');
	}
		glavniSablon.instance.cleanElement('center');	
		 let center= document.getElementById('center');
		
		let element=document.createElement('div');
		let element2=document.createElement('div');
			element2.innerHTML='Home Premium Logedd in conntent';
			
		element.appendChild(element2);
		center.appendChild(element);
  } 

napraviFrontControlerComunicationPolje(){
	let aside = document.getElementById('assideR2');
	
	let infoDiv = document.createElement("div");
		infoDiv.setAttribute('class','regDiv');
		infoDiv.setAttribute('id','serverInfo');
		infoDiv.style.width='100%';
		infoDiv.innerHTML='Server Info';	
		
		aside.appendChild(infoDiv);	
	
	
	let communicationField=document.createElement('div');
		communicationField.setAttribute('class','commField');
		communicationField.setAttribute('id','commField');
		
	let communicationImgDiv=document.createElement('div');
		communicationImgDiv.setAttribute('class','commField');
		communicationImgDiv.setAttribute('id','communicationImgDiv');	

	let communicationCommDiv=document.createElement('div');
		communicationCommDiv.setAttribute('class','commField');
		communicationCommDiv.setAttribute('id','communicationCommDiv');	
	
	
	let communicationCommwDiv=document.createElement('canvas');
		communicationCommwDiv.setAttribute('class','commFielde');
		communicationCommwDiv.setAttribute('id','loadingCanvas');		

		communicationImgDiv.appendChild(communicationCommwDiv);
		
		communicationField.appendChild(communicationImgDiv);
		communicationField.appendChild(communicationCommDiv);
		
		aside.appendChild(communicationField);
		eventController.instance.prikaziInformacije();
}





napraviReg(){
	
	if(document.getElementById('formLog')){

	
		document.getElementById('loginDivCont').style.display='none';
				document.getElementById('formLog').style.display='none';
				eventController.instance.removeValidateLogEvents();
				glavniSablon.instance.removeElement('formLog');
				logining.instance='';
				
				
				this.superReg();
		
		}
		else{
		
		
			this.superReg();
			
		}
	
		
	
	
} 

superReg(){

	if(document.getElementById('formReg')){
	
			if(document.getElementById('regDivCont').style.display == 'none'){
				this.napraviRegSablon();	
				document.getElementById('regDivCont').style.display='block';
				document.getElementById('formReg').style.display='block';
				eventController.instance.validateRegEvents();
				
			}
			else{
				document.getElementById('regDivCont').style.display='none';
				document.getElementById('formReg').style.display='none';
				eventController.instance.removeValidateRegEvents();
				glavniSablon.instance.removeElement('formReg');
				register.instance='';
			
			}
	
	}
else{
		this.napraviRegSablon();	
		
		document.getElementById('formReg').style.display='block';
		document.getElementById('regDivCont').style.display='block';
		
		
		
		
	eventController.instance.validateRegEvents();

	}
	
}





prikaziRegDugme() {


		if( document.brojacHelpIme == 1 && document.brojacHelpEmail == 1 && document.brojacHelpPass == 1){
			if(document.getElementById('submitReg')){
				this.removeElement('submitReg');
			}
			console.log('svi parametri su ok');
			
			let fieldset = document.getElementById("fieldsetReg");
				
		let submitReg = document.createElement("button");
			submitReg.setAttribute('class','submitReg');

			submitReg.setAttribute('id','submitReg');
			submitReg.innerHTML='Registruj se';
			fieldset.appendChild(submitReg);

			document.getElementById("submitReg").addEventListener("click", function(){
					forntCommController.instance.posaljiServeru('reg');
				}, false);
		}	
		else{
			console.log('nisu svi parametri ok');
			if(document.getElementById('submitReg')){
				this.removeElement('submitReg');
			}
			
			
		}
			
}

confirmPassword(password,confirm_password){

  if(password.value != confirm_password.value) {
		console.log('passwordi moraju biti jednaki');
		
		document.brojacHelpPass=0;
		this.prikaziRegDugme();	
	
		document.getElementById('confirm_password_downLab').innerHTML ='Paswordi se ne podudaraju';
  }
  else {
	  
	  if(password.value != '' && confirm_password.value != ''){
	  console.log('ovo je ok');
	
	document.brojacHelpPass=1;
	this.prikaziRegDugme();
	document.getElementById('confirm_password_downLab').innerHTML ='Paswordi se podudaraju';
	}
  }
  

}

validirajKorisnickoIme(username){
 
  if(username.value.length<6 || username.value.length>32) {
		console.log('korisnicko 6 - 32 karaktera mora biti');

	
	  document.brojacHelpIme = 0;
		this.prikaziRegDugme();
		
  }
  else {

	
			


	
	  forntCommController.instance.posaljiServeru('proverikorime');
	  
  }
  

}

validirajEmail(email){
 
  if(email.value.length<6 || email.value.length>64) {
		console.log('email mora biti od 6 do 64');
		document.brojacHelpEmail =0;
		this.prikaziRegDugme();

		
		
  }
  else {
	  	 
	  
	
	  forntCommController.instance.posaljiServeru('proveriemail');
	
  }
  

}



napraviLog(){
	
		if(document.getElementById('formReg')){
			document.getElementById('regDivCont').style.display='none';
				document.getElementById('formReg').style.display='none';
				eventController.instance.removeValidateRegEvents();
				glavniSablon.instance.removeElement('formReg');
				
				register.instance='';
				
			this.superLog();
		}
	else{
		
		
		this.superLog();
	}



}

superLog(){

	
		if(document.getElementById('formLog')){
			if(document.getElementById('loginDivCont').style.display =='none'){
				this.napraviLogSablon();
				eventController.instance.validateLogEvents();
				document.getElementById('loginDivCont').style.display='block';
				document.getElementById('formLog').style.display='block';
			}
			else{
				document.getElementById('loginDivCont').style.display='none';
				document.getElementById('formLog').style.display='none';
				eventController.instance.removeValidateLogEvents();
				glavniSablon.instance.removeElement('formLog');
				logining.instance='';
			}
		
	
	}
else{
		
		this.napraviLogSablon();	
		document.getElementById('formLog').style.display='block';	
		document.getElementById('loginDivCont').style.display='block';	
			
			
		eventController.instance.validateLogEvents();

		
}


}

prikaziLogDugme() {
	console.log('brojacImeLog  ' + document.brojacHelpImeLog);
	console.log('brojacPasLog  ' + document.brojacHelpPassLog);
		if( document.brojacHelpImeLog == 1 && document.brojacHelpPassLog == 1){
			if(document.getElementById('submitLog')){
				this.removeElement('submitLog');
			}
		
			console.log('svi parametri su ok');
			
		let fieldset = document.getElementById("fieldsetLog");
				

		
		let submitLog = document.createElement("button");
			submitLog.setAttribute('class','submitLog');
			submitLog.setAttribute('id','submitLog');
			submitLog.innerHTML='Log in';
			fieldset.appendChild(submitLog);
			
			
			

			document.getElementById("submitLog").addEventListener("click", function(){
					forntCommController.instance.posaljiServeru('log');
				}, false);
		
		}	
		else{
			console.log('nisu svi parametri ok');
			if(document.getElementById('submitLog')){
				this.removeElement('submitLog');
			}
			
			
		}
			
}



validateUsernameLog(username){

	
	
  if(username.value.length<6 || username.value.length>32) {
		console.log('korisnicko 6 - 32 karaktera mora biti');
		document.brojacHelpImeLog=0;
		this.prikaziLogDugme();
		
  }
  else {
	  console.log('tako treba');
	
		forntCommController.instance.posaljiServeru('proverikorimeLog');
	
  }
  

}

validatePasswordLog(password){
 
  if(password.value.length<6 || password.value.length>32) {
		console.log('korisnicko 6 - 32 karaktera mora biti');
		document.brojacHelpPassLog =0;
		this.prikaziLogDugme();
  }
  else {
	  console.log('tako treba');
	  document.brojacHelpPassLog =1;
	  this.prikaziLogDugme();
  }
  

}   







}  

class UrlController {
	
constructor(content, title, url) {

 
    this._content = content;
    this._title = title;
	this._url = url;
	
	this.push_state();
	
	
	window.addEventListener('popstate', function (event) {
    if (history.state && history.state.id === 'naslovna') {

			homepage.instance = new Homepage();
		
		document.title = "Naslovna | Blazing Sun";
    }
	else if (history.state && history.state.id === 'bingo') {

		bingo.instance = new BingoTiketSistem(0, 0);
		document.title = "Bingo | Blazing Sun";
	
    } 
	
	else if (history.state && history.state.id === 'privacy-policy') {

		privacyPolicy.instance = new PrivacyPolicy();
		document.title = "Privacy Policy | Blazing Sun";
	
    } 
}, false);
	
  }

push_state(content, title, url){
	  let contente,titlete, urle;
	  if(content){
		  contente = content;
	  }
	  else {
		  contente = this._content;
		  
	  }
	  if (title){
		  titlete = title;
	  }
	  else{
		  titlete = this._title;
	  }
	    if (url){
		  urle = url;
	  }
	  else{
		  urle = this._url;
	  }
	  history.pushState({
    id: contente
}, titlete, urle);
document.title = titlete;
	
	
	this.pomocnikInicijalizacije(contente);
	
	  
  }
  

pomocnikInicijalizacije(content){
	
	
		switch (content) {
			
			  case 'bingo':
					bingo.instance = new BingoTiketSistem(0, 0);
					eventController.instance.pageChangeRemoveEvent(content);
				break;
				
			  case 'naslovna':
					homepage.instance = new Homepage();
					eventController.instance.pageChangeRemoveEvent(content);
				break;
				
			case 'privacy-policy':
					privacyPolicy.instance = new PrivacyPolicy();
					eventController.instance.pageChangeRemoveEvent(content);
				break;	
		}
	
	
}	
	 
 
  
}



class UserController {
	
constructor(korisnik,nivopristupa,logovan,stranica,token,adresa,naslov ) {


	
	 this._korisnik = korisnik;
	  this._nivopristupa = nivopristupa;
	   this._logovan = logovan;
	    this._stranica = stranica;
		 this._token = token;
		this._adresa = adresa;
		 this._naslov = naslov; 

	this.takeCookie();

				var xzy = window.location.href;
				
 if (xzy.indexOf("?aktivirajNalog") >= 0) {
			console.log('testarica');
		   forntCommController.instance.posaljiServeru('aktNal');
		    
	 
	
 }


  }
  
  

get korisnik() {
    return this._korisnik;
  }
  
set korisnik(korisnik) {
    
	this._korisnik = korisnik;
  }

get nivopristupa() {
    return this._nivopristupa;
  }
  
set nivopristupa(nivopristupa) {
    
	this._nivopristupa = nivopristupa;
  }  
get logovan() {
    return this._logovan;
  }
  
set logovan(logovan) {
    
	this._logovan = logovan;
  } 
get stranica() {
    return this._stranica;
  }
  
set stranica(stranica) {
    
	this._stranica = stranica;
  }
get token() {
    return this._token;
  }
  
set token(token) {
    
	this._token = token;
  }   

takeCookie(){
	
	let kokoje = cookieController.instance.getCookie('documentCookie');
	
	   

  if (kokoje != "") {
	  let kikoje = JSON.parse(kokoje);
	
		this._korisnik = kikoje.korisnik;
		this._nivopristupa = kikoje.nivopristupa;
		this._logovan = kikoje.logovan;
		this._stranica = kikoje.stranica;
		this._token = kikoje.token;
		this._adresa = kikoje.adresa;
		this._naslov = kikoje.stranica.charAt(0).toUpperCase() + ' | Blazing Sun'; 
		
			 console.log(kikoje);
		 }
		console.log(kokoje);	
	
}
isLoggedIn(){
	if(this._logovan === 'da'){
		this.srediLoggedIn();
		return true;
		
	}
	else{
		return false;
	}
}

logoutNow(){
	
		this._korisnik = 'gost';
		this._nivopristupa = 0;
		this._logovan = 'ne';
		let s = window.location.pathname;
			s = s.substr(1);
		this._stranica = s;
		this._token = '01234567899876543210';
		this._adresa = window.location.href;
		this._naslov = s.charAt(0).toUpperCase() + ' | Blazing Sun'; 
		
			cookieController.instance.setCookie('documentCookie', '', 0);
			glavniSablon.instance.cleanElement('assideR');
			glavniSablon.instance.napraviLogReg();
		
			switch (s) {
			
			  case 'bingo':
					bingo.instance = new BingoTiketSistem(0, 0);
					 
					url.instance.push_state('bingo', 'Bingo | Blazing Sun','https://blazingsun.space/bingo');
				break;
				
			  case 'naslovna':
					homepage.instance = new Homepage();
					url.instance.push_state('naslovna', 'Naslovna | Blazing Sun','https://blazingsun.space/naslovna');
				break;
				case 'privacy-policy':
					privacyPolicy.instance = new PrivacyPolicy();
					url.instance.push_state('privacy-policy', 'Privacy Policy | Blazing Sun','https://blazingsun.space/privacy-policy');
				break;
				
		}
	
		
		
}
srediLoggedIn() {
	if(document.getElementById('assideRLogOut')){
		glavniSablon.instance.removeElement('assideRLogOut');
	}
	let assideR = document.getElementById('assideR');
				let	assideRLogOut = document.createElement('div');
					assideRLogOut.setAttribute('class','assideRLogOut');
					assideRLogOut.setAttribute('id','assideRLogOut');
					assideRLogOut.innerHTML='Log out';
				assideR.appendChild(assideRLogOut);	
				
				eventController.instance.logoutEvent();
	
}
}

class EventController {
	
	
	constructor() {
	


}
removeLogoutEvents(){
	
	document.getElementById('assideRLogOut').onkeyup = null;
	
}
removelogRegEvents(){
	document.getElementById('loginDiv').onkeyup = null;
	document.getElementById('regDiv').onkeyup = null;
}
removeValidateRegEvents(){
	document.getElementById('email').onkeyup = null;
	document.getElementById('usernameReg').onkeyup = null;
	document.getElementById('passwordReg').onkeyup = null;
	document.getElementById('confirm_password').onkeyup = null;
	

	
}

removeValidateLogEvents(){
	document.getElementById('passwordLog').onkeyup = null;
	document.getElementById('usernameLog').onkeyup = null;

	


	
}	

pageChangeRemoveEvent(parameter){

let bingo = document.getElementById("bingoStranica"), home = document.getElementById("homeStranica"), privacyStranica = document.getElementById("privacyPolicyStranica");	
	 	
	
	if(parameter == 'naslovna'){
	
		document.getElementById('homeStranica').onclick = null;
		
		if(document.getElementById('bingoStranica').onclick == null){
					bingo.onclick = function() {
					page.instance.napraviBingoStranicu();
			}
			
		}
		else if(document.getElementById('privacyPolicyStranica').onclick == null){
					privacyStranica.onclick = function() {
					page.instance.napraviPrivacyPolicyStranicu();
			}
			
		}
	}
	else if(parameter == 'bingo'){
		
		 document.getElementById('bingoStranica').onclick = null;
		 
		 if(document.getElementById('homeStranica').onclick == null){
					home.onclick = function() {
					page.instance.napraviGlavnuStranicu();
			}
		}
		else if(document.getElementById('privacyPolicyStranica').onclick == null){
					privacyStranica.onclick = function() {
					page.instance.napraviPrivacyPolicyStranicu();
			}
		}
		 
	}
	else if(parameter == 'privacy-policy'){
		
		 document.getElementById('privacyPolicyStranica').onclick = null;
		 
		if(document.getElementById('homeStranica').onclick == null){
					home.onclick = function() {
					page.instance.napraviGlavnuStranicu();
			}
		}
		else if(document.getElementById('bingoStranica').onclick == null){
					bingo.onclick = function() {
					page.instance.napraviBingoStranicu();
			}
			
		}
		 
	}
	else{
		console.log('za tu stranicu nemamo pravilo');
	}
}

svemirPageShow(){
	let svemirko = document.getElementById('svemirCreate');
	
	console.log(svemirko);

	svemirko.onclick = function() {
			console.log('clicked');
	let svemirControll= document.getElementById('svemirControll');
	if(svemirControll){
		eventController.instance.removeSvemirChangeEvents();
		glavniSablon.instance.removeElement('svemirControll');
		
	}		
			else{
				if(localStorage.getItem('svemirTemplate')){
		
			console.log(JSON.parse(localStorage.getItem('svemirTemplate')));
			forntCommController.instance.prikaziTemplate(JSON.parse(localStorage.getItem('svemirTemplate')));
					
			
		
		}
	else{
		forntCommController.instance.potraziTemplate('kontrolaSvemira.json');  
		}
			}
	
	}
	
	
}

removeSvemirChangeEvents(){
		document.getElementById('butonSvemir').onclick = null;
}

svemirChangeEvents(){
	let svemir = document.getElementById("butonSvemir");
	 
	
svemir.onclick = function() {
		let brojZvezda = document.getElementById('brojZvezda');
		let radius = document.getElementById('radiusZv');
		let razdaljina = document.getElementById('focalLen');
	

		console.log('ovo je broj zvezda : ' + brojZvezda.value);
		console.log(window.svemir);
		if(brojZvezda.value != ''){
			window.svemir.instance.numStars=brojZvezda.value;
		}
		if(radius.value != ''){
			window.svemir.instance.radius=radius.value;
		}
		if(razdaljina.value != ''){
			window.svemir.instance.focalLength=razdaljina.value;
		}
		console.log('clicked');
}

	
}

pageChangeEvents(){
	let bingo = document.getElementById("bingoStranica"), home = document.getElementById("homeStranica"), privacyPolicyStranica = document.getElementById("privacyPolicyStranica");	
bingo.onclick = function() {
		page.instance.napraviBingoStranicu();
}
home.onclick = function() {
		page.instance.napraviGlavnuStranicu();
}
privacyPolicyStranica.onclick = function() {
		page.instance.napraviPrivacyPolicyStranicu();
}	
}

prikaziInformacije(){
	 
	 let informacijePom= document.getElementById('commField'), informacije= document.getElementById('serverInfo'); 

informacije.onclick = function() {

console.log('clicked');
console.log(informacijePom);

console.log(informacijePom.style);
		if(informacijePom.style.display === 'none'){  
			console.log('none or nothing');
			informacijePom.style.display  ='block';
		}else{
			informacijePom.style.display ='none';
		}

}

	
}
logoutEvent(){
	let logout = document.getElementById("assideRLogOut");
	logout.onclick = function() {
			user.instance.logoutNow();
		}
}

logRegEvents(){
	let login = document.getElementById("loginDiv"), registerDiv = document.getElementById("regDiv");

login.onclick = function() {
	logining.instance = new Logining();
}
registerDiv.onclick = function() {
		register.instance = new Registracija();
}
}
validateRegEvents(){
	
				
let email = document.getElementById("email"), username = document.getElementById("usernameReg"), password=document.getElementById("passwordReg"), confirm_password=document.getElementById("confirm_password");


username.onkeyup = function() {
		glavniSablon.instance.validirajKorisnickoIme(username);	
}


email.onkeyup =  function() {
		glavniSablon.instance.validirajEmail(email);	
}



confirm_password.onkeyup = function() {
		glavniSablon.instance.confirmPassword(password,confirm_password);	
}
password.onkeyup = function() {
		glavniSablon.instance.confirmPassword(password,confirm_password);	
}


}

validateLogEvents(){
	
	let password = document.getElementById("passwordLog"), username = document.getElementById("usernameLog");


username.onkeyup = function() {
		glavniSablon.instance.validateUsernameLog(username);	
}
password.onkeyup = function() {
		glavniSablon.instance.validatePasswordLog(password);	
}



	
}

}

class FrontComunicationController {

constructor() {
	


}

posaljiServeru(pokazivac, prvi, drugi, treci, cetvrti){
	
	

let http = new XMLHttpRequest();
let params;
let url = 'controller.php';
if(pokazivac === 'reg'){
 params = 'pokazivacReg=' + document.getElementById('pokazivacReg').value + '&' + 'usernameReg=' + document.getElementById('usernameReg').value  + '&' + 'email=' + document.getElementById('email').value + '&' + 'passwordReg=' + document.getElementById('passwordReg').value;
}
else if(pokazivac === 'log'){
 params = 'pokazivacLog=' + document.getElementById('usernameLog').value + '&' + 'passwordLog=' + document.getElementById('passwordLog').value;

}
else if(pokazivac === 'proverikorimeLog'){
 params = 'usernameCheckLog=' + document.getElementById('usernameLog').value;

}
else if(pokazivac === 'proverikorime'){
 params = 'usernameCheck=' + document.getElementById('usernameReg').value + '&' + 'usernameReg=' + document.getElementById('usernameReg').value;

}
else if(pokazivac === 'proveriemail'){
 params = 'emailCheck=' + document.getElementById('usernameReg').value + '&' + 'email=' + document.getElementById('email').value;
	
}
else if(pokazivac === 'aktNal'){
	
  let res = window.location.href.split("/?aktivirajNalog=");
	params = 'active=' + res[1];
	
}

else if(pokazivac === 'vratiRand'){
	params = 'index=' + prvi;

	
}
else if(pokazivac === 'napraviToken'){
	params = 'napraviToken=da'  + '&' + 'microtimeh=' + prvi + '&' + 'stranica=' + drugi+ '&' + 'korisnik=' + treci;

	
}
else if(pokazivac === 'proveriToken'){
	console.log('jebac 2 imekorisnika : ' + prvi+'|');
	console.log('jebac 2 token : ' + drugi+'|');
	console.log('jebac 2 pristup : ' + cetvrti+'|');
	console.log('jebac 2 stranica : ' + treci+'|');
	params = 'proveriToken=da'  + '&' + 'korisnik=' + prvi + '&' + 'token=' + drugi+ '&' + 'stranica=' + treci+ '&' + 'nivoPristupa=' + cetvrti;
}
else{
 params = 'pokazivacGeg=Krmcica';	
}

http.open('POST', url, true);

//Send the proper header information along with the request
http.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
http.onloadstart  = function() {


	 
	   let keeke2 = document.getElementById('loadingCanvas');
if(keeke2){
	keeke2.setAttribute('style','display:block;');
}



	
	



}
http.onreadystatechange = function() {
    if(http.readyState == 4 && http.status == 200) {
 	let today = new Date();
let date = today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
let time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
let dateTime = time;
forntCommController.instance.napraviAnimaciju();
	let communicationCommDiv=document.getElementById('communicationCommDiv');

		
	   let keeke2 = document.getElementById('loadingCanvas');
if(keeke2){
	keeke2.setAttribute('style','display:none;');
}
	
        console.log(http.responseText);
		console.log(JSON.parse(http.responseText).parametar);
		
		if(JSON.parse(http.responseText).parametar  === 'daUsername'){
			console.log('taj username je ok.');
			document.brojacHelpIme=1;
				glavniSablon.instance.prikaziRegDugme();	
			document.getElementById('usernameRegLabDown').innerHTML=JSON.parse(http.responseText).info;

		}
		else if(JSON.parse(http.responseText).parametar === 'neUsername'){
			console.log('izaberite drugi username taj neko vec koristi.');
			
				document.brojacHelpIme=0;
				glavniSablon.instance.prikaziRegDugme();
				document.getElementById('usernameRegLabDown').innerHTML=JSON.parse(http.responseText).info;
				}
	
	
		else if(JSON.parse(http.responseText).parametar === 'daEmail'){
			console.log('taj email je ok.');
				document.brojacHelpEmail=1;
				glavniSablon.instance.prikaziRegDugme();
				document.getElementById('emailRegLabDown').innerHTML=JSON.parse(http.responseText).info;
				
		}
		else if(JSON.parse(http.responseText).parametar === 'neEmail'){
			console.log('izaberite drugi email taj neko vec koristi.');
		
			document.brojacHelpEmail=0;
			glavniSablon.instance.prikaziRegDugme();
			document.getElementById('emailRegLabDown').innerHTML=JSON.parse(http.responseText).info;
			
		}
		
		else if(JSON.parse(http.responseText).parametar === 'nalogAktiviran'){


			
				document.getElementById('regDivCont').style.display='block';
				document.getElementById('loginDivCont').style.display='none';
				glavniSablon.instance.removeElement('regDiv');
				document.getElementById('loginDiv').style.width='100%';
				
				
				forntCommController.instance.pomocnikPushState('activate', 'Aktivacija naloga | Blazing Sun', 'https://blazingsun.space/aktivacija-naloga')
				communicationCommDiv.innerHTML='<hr><b style="font-size:10px;">Poruka od servera </b><b style="font-size:10px;">[' + dateTime + ' ] :</b> ' + JSON.parse(http.responseText).info + communicationCommDiv.innerHTML;
				
				}
			else if(JSON.parse(http.responseText).parametar === 'nalogNijeAktiviran'){
		
			
				
				communicationCommDiv.innerHTML='<hr><b style="font-size:10px;">Poruka od servera </b><b style="font-size:10px;">[' + dateTime + ' ] :</b> ' + JSON.parse(http.responseText).info + communicationCommDiv.innerHTML;
				}
				
			else if(JSON.parse(http.responseText).parametar === 'nalogNijeAktiviranGreska'){
		
			
				
				communicationCommDiv.innerHTML='<hr><b style="font-size:10px;">Poruka od servera </b><b style="font-size:10px;">[' + dateTime + ' ] :</b> ' + JSON.parse(http.responseText).info + communicationCommDiv.innerHTML;
				}
			else if(JSON.parse(http.responseText).parametar === 'konekcijaNeuspesna'){
		
			
				
				communicationCommDiv.innerHTML='<hr><b style="font-size:10px;">Poruka od servera </b><b style="font-size:10px;">[' + dateTime + ' ] :</b> ' + JSON.parse(http.responseText).info + communicationCommDiv.innerHTML;
				}
			
			else if(JSON.parse(http.responseText).parametar === 'nePristup'){
		
			
				
				communicationCommDiv.innerHTML='<hr><b style="font-size:10px;">Poruka od servera </b><b style="font-size:10px;">[' + dateTime + ' ] :</b> ' + JSON.parse(http.responseText).info + communicationCommDiv.innerHTML;
				}
			
			else if(JSON.parse(http.responseText).parametar === 'daPristup'){
					let userica = '{"korisnik":"'+ JSON.parse(http.responseText).korisnikR +'","nivopristupa":"'+ JSON.parse(http.responseText).nivoPristupa +'", "logovan":"'+ user.instance.logovan +'","stranica":"'+JSON.parse(http.responseText).stranicaR+'","adresa":"'+JSON.parse(http.responseText).adresa+'","token":"'+JSON.parse(http.responseText).token+'"}';
				
					cookieController.instance.setCookie('documentCookie', userica, 30);
				
					user.instance.korisnik = JSON.parse(http.responseText).korisnikR;
					  user.instance.nivopristupa =JSON.parse(http.responseText).nivoPristupa;
					   user.instance.logovan =user.instance.logovan;
						user.instance.stranica =JSON.parse(http.responseText).stranicaR;
						user.instance.token = JSON.parse(http.responseText).token;
						user.instance.adresa = JSON.parse(http.responseText).adresa;
						user.instance.naslov = JSON.parse(http.responseText).naslov; 	
			
					
					
				
					forntCommController.instance.pomocnikPushState(JSON.parse(http.responseText).stranicaR, JSON.parse(http.responseText).naslov,JSON.parse(http.responseText).adresa);
					
						
						
				communicationCommDiv.innerHTML='<hr><b style="font-size:10px;">Poruka od servera </b><b style="font-size:10px;">[' + dateTime + ' ] :</b> ' + JSON.parse(http.responseText).info + communicationCommDiv.innerHTML;
				}	
			
			else if(JSON.parse(http.responseText).parametar === 'konekcijaUspesna'){
		
			
				
				communicationCommDiv.innerHTML='<hr><b style="font-size:10px;">Poruka od servera </b><b style="font-size:10px;">[' + dateTime + ' ] :</b> ' + JSON.parse(http.responseText).info + communicationCommDiv.innerHTML;
				}		
		else if(JSON.parse(http.responseText).parametar === 'Mail nije poslat'){
		
			
				
				communicationCommDiv.innerHTML='<hr><b style="font-size:10px;">Poruka od servera </b><b style="font-size:10px;">[' + dateTime + ' ] :</b> ' + JSON.parse(http.responseText).info + communicationCommDiv.innerHTML;
				}
		else if(JSON.parse(http.responseText).parametar === 'daTokenUspesan'){
			
			user.instance.logovan = 'da';
			user.instance.token = JSON.parse(http.responseText).token;	
			user.instance.korisnik = JSON.parse(http.responseText).usernameUspeh;
			
			
				let userica = '{"korisnik":"'+ JSON.parse(http.responseText).usernameUspeh +'","nivopristupa":"'+ user.instance.nivopristupa +'", "logovan":"'+ user.instance.logovan +'","stranica":"'+user.instance.stranica+'","adresa":"'+user.instance.adresa+'","token":"'+JSON.parse(http.responseText).token+'"}';
				
			
				cookieController.instance.setCookie('documentCookie', userica, 30);
				 
				
				communicationCommDiv.innerHTML='<hr><b style="font-size:10px;">Poruka od servera </b><b style="font-size:10px;">[' + dateTime + ' ] :</b> ' + JSON.parse(http.responseText).info + communicationCommDiv.innerHTML;
				
					 cookieController.instance.checkCookie(userica,'documentCookie');
				
				}
		else if(JSON.parse(http.responseText).parametar === 'neTokenUspesan'){
		
			
				
				communicationCommDiv.innerHTML='<hr><b style="font-size:10px;">Poruka od servera </b><b style="font-size:10px;">[' + dateTime + ' ] :</b> ' + JSON.parse(http.responseText).info + communicationCommDiv.innerHTML;
				}
				
		
				
				
		else if(JSON.parse(http.responseText).parametar === 'uspesnoLogovanje'){
		
					let xe=window.location.pathname.substr(1);
				
				  user.instance.korisnik = JSON.parse(http.responseText).korisnik;
				  user.instance.nivopristupa = '1';
				  user.instance.logovan = 'da';
				  
				  user.instance.stranica = xe;
				  user.instance.adresa = window.location.href;
				  user.instance.naslov = xe.charAt(0).toUpperCase() + ' | Blazing Sun';
				 

	 
	
				communicationCommDiv.innerHTML='<hr><b style="font-size:10px;">Poruka od servera </b><b style="font-size:10px;">[' + dateTime + ' ] :</b> ' + JSON.parse(http.responseText).info + communicationCommDiv.innerHTML;
				
				glavniSablon.instance.cleanElement('assideR');
				user.instance.srediLoggedIn();
				
				
				
				glavniSablon.instance.napraviHomePremiumSablon();
				
					let d = new Date();
					let n = d.getMilliseconds();
					let stranica = user.instance.stranica;
					let korisnik = JSON.parse(http.responseText).korisnik;
					
				tokenController.instance.napraviToken(n,stranica,korisnik);
				
			
				}
		else if(JSON.parse(http.responseText).parametar === 'neuspesnoLogovanje'){
		
				  user.instance.korisnik = "gost";
				  user.instance.nivopristupa = '0';
				  user.instance.logovan = 'ne';

				communicationCommDiv.innerHTML='<hr><b style="font-size:10px;">Poruka od servera </b><b style="font-size:10px;">[' + dateTime + ' ] :</b> ' + JSON.parse(http.responseText).info + communicationCommDiv.innerHTML;
				
				}	
		else if(JSON.parse(http.responseText).parametar === 'noUsernameLog'){
		
			document.brojacHelpImeLog=0;	
		
			glavniSablon.instance.prikaziLogDugme();
			let labelK2 = document.getElementById('usernameLogLog2');
			glavniSablon.instance.cleanElement('usernameLogLog2');
				console.log(document.brojacHelpImeLog);
				labelK2.innerHTML=JSON.parse(http.responseText).info;
				}
		else if(JSON.parse(http.responseText).parametar === 'yesUsernameLog'){

			document.brojacHelpImeLog=1;
			
			glavniSablon.instance.prikaziLogDugme();

		let labelK2 = document.getElementById('usernameLogLog2');
			glavniSablon.instance.cleanElement('usernameLogLog2');
				console.log(document.brojacHelpImeLog);
				labelK2.innerHTML=JSON.parse(http.responseText).info;
				}		
		else if(JSON.parse(http.responseText).parametar === 'Mail je poslat'){
		
			
				
				communicationCommDiv.innerHTML='<hr><b style="font-size:10px;">Poruka od servera </b><b style="font-size:10px;">[' + dateTime + ' ] :</b> ' + JSON.parse(http.responseText).info + communicationCommDiv.innerHTML;
				}
				
				else if(JSON.parse(http.responseText).parametar === 'dvanaestRandomBrojeva'){
		
				
					bingo.instance.zapocniIgru(http.responseText);
				console.log(JSON.parse(http.responseText).info);
				}	
		else if(JSON.parse(http.responseText).parametar === 'aktivacijaPoslata'){
		
				document.getElementById('regDivCont').style.display='none';
				glavniSablon.instance.cleanElement('formReg');
				document.getElementById('regDivCont2').style.display='block';
				document.getElementById('loginDivCont2').style.display='none';
				communicationCommDiv.innerHTML='<hr><b style="font-size:10px;">Poruka od servera </b><b style="font-size:10px;">[' + dateTime + ' ] :</b> ' + JSON.parse(http.responseText).info + communicationCommDiv.innerHTML;
				}
	
				
				
		else{
			let aside= document.getElementById('praviAssideL');
		let obavestenje = document.createElement('h3');
			obavestenje.setAttribute('style','float:left;width:100%;');

			obavestenje.innerHTML = http.responseText;
			aside.appendChild(obavestenje);
			glavniSablon.instance.removeElement('formReg');
		}
		
        
    }
}

http.onerror  = function() {
	
	   let keeke2 = document.getElementById('loadingCanvas');
if(keeke2){
		keeke2.setAttribute('style','display:none;');
}
	
}
http.send(params);


			}

pomocnikPushState(prvi,drugi,treci){
	url.instance.push_state(prvi, drugi,treci);
	
}

napraviAnimaciju(){
	
	(function(){ 
	
  var c=document.getElementById('loadingCanvas'),
    ctx=c.getContext('2d'),
    pi = Math.PI,
    xCenter = c.width/2,
    yCenter = c.height/2,
    radius = c.width/6,
    startSize = radius/3,
    num=10,
    posX=[],posY=[],angle,size,i;

  window.setInterval(function() {
    num++;
    ctx.clearRect ( 0 , 0 , xCenter*2 , yCenter*2 );
    for (i=0; i<9; i++){
      ctx.beginPath();
      ctx.fillStyle = 'rgba(69,99,255,'+.1*i+')';
      if (posX.length==i){
        angle = pi*i*.25;
        posX[i] = xCenter + radius * Math.cos(angle);
        posY[i] = yCenter + radius * Math.sin(angle);
      }
      ctx.arc(
        posX[(i+num)%8],
        posY[(i+num)%8],
        startSize/9*i,
        0, pi*2, 1); 
      ctx.fill();
    }
  }, 100);
  
})();
	
}

potraziTemplate(file){
	if(file !== ''){
			   let keeke2 = document.getElementById('loadingCanvas');
if(keeke2){
	keeke2.setAttribute('style','display:block;');
}	
		fetch('https://blazingsun.space/assets/templates/' + file)
  .then(function(response) {
    return response.json(); 

  })
  .then(function(myJson) {
    console.log(myJson);


	
	
	forntCommController.instance.prikaziTemplate(myJson);

	
					
			localStorage.setItem("svemirTemplate", JSON.stringify(myJson));
				   let keeke2 = document.getElementById('loadingCanvas');
if(keeke2){
	keeke2.setAttribute('style','display:none;');
}
  });
	
	}
	
}

prikaziTemplate(myJson){
	
		let obj =myJson;
	let kontejner=document.getElementById(obj.kontejner);
let pomocniKontejner = document.createElement('div');
	pomocniKontejner.setAttribute('id',obj.pomocniKontejner)

for(let i = 0; i<obj.elementi.length;i++){
	let element = document.createElement(obj.elementi[i].staKreirati);
		for(let j=0; j<obj.elementi[i].atributi.niz.length; j++){
						element.setAttribute(obj.elementi[i].atributi.niz[j].clan[0],obj.elementi[i].atributi.niz[j].clan[1]);

		}
		if(obj.elementi[i].innerHtml){
			element.innerHTML=obj.elementi[i].innerHtml;
		}
		
		pomocniKontejner.appendChild(element);

	
}
	kontejner.appendChild(pomocniKontejner);


			eventController.instance.svemirChangeEvents();
	
}

	
}

class Homepage {
	constructor() {
		
		this.napraviHomepage();
	}
	
	napraviHomepage(){
		if(user.instance.isLoggedIn()){
				  
			      glavniSablon.instance.napraviHomePremiumSablon();
		}else{
				glavniSablon.instance.napraviHomeSablon();
		}
	}
}


class PrivacyPolicy {
	constructor() {
		
		this.napraviPrivacyPolicy();
	}
	
	napraviPrivacyPolicy(){
		glavniSablon.instance.napraviPrivacyPolicySablon();
		
	}
}

class Registracija {
	constructor() {
		
		this.napraviRegister();
	}
	
	napraviRegister(){
		if(user.instance.isLoggedIn()){
				  
			     
		}else{
				glavniSablon.instance.napraviReg();
		}
	}
}


class Logining {
	constructor() {
		
		this.napraviRegister();
	}
	
	napraviRegister(){
		if(user.instance.isLoggedIn()){
				  
			     
		}else{
				glavniSablon.instance.napraviLog();
		}
	}
}

class Svemir {

    constructor(numStars, radius, focalLength) {
    this._canvas = document.getElementById("canvasss");
    this._c = this._canvas.getContext("2d");
	this._numStars = numStars;
	this._radius = radius;
	this._focalLength = focalLength;
	this._centerX = 0;
	this._centerY = 0;
	this._stars = [];
	this._star = [];


	this.initializeStars('prvi');
	let animate = true;
	this.executeFrame(animate);



			
 


 
	}		

get numStars() {
    return this._numStars;
  }
  
set numStars(numStars) {
    
	this._numStars = numStars;
  }
get radius() {
    return this._radius;
  }
  
set radius(radius) {
    
	this._radius = radius;
  }  
get focalLength() {
    return this._focalLength;
  }
  
set focalLength(focalLength) {
    
	this._focalLength = focalLength;
  } 

executeFrame(animate){
	if(animate){
		console.log('sad je true');
	document.zvezdan=0;
window.myVar = setInterval(function() {
  svemir.instance.moveStars();
  svemir.instance.drawStars();
  document.zvezdan++;
    }, 1);
	}
	else{
		console.log('sad je false ');
		clearInterval(window.myVar);
	}
}

initializeStars(){
  this._centerX =  this._canvas.width / 2;
  this._centerY =  this._canvas.height / 2;
  

  for(let i = 0; i < this._numStars; i++){
	
       this._star = {
      x: Math.random() * this._canvas.width,
      y: Math.random() * this._canvas.height,
      z: Math.random() * this._canvas.width
    };
    this._stars.push(this._star);

		 
	
  } 
}

moveStars(){
  for(let i = 0; i < this._numStars; i++){
    this._star = this._stars[i];
   


		if((i % 3) == 0){
			 this._star.z--;
		
		}
		else{
			if((i % 2) == 0){
			 this._star.z--;
		
		}
		else if((i % 4) == 0){
			 this._star.z--;
		
		}
		else if((i % 5) == 0){
			 this._star.z--;
		
		}
		else if((i % 6) == 0){
			 this._star.z--;
		
		}
		}
		
	
    if(this._star.z <= 0){
		

      this._star.z =  this._canvas.width;
    }
  }
}

drawStars(){
  var pixelX, pixelY, pixelRadius;
  
  // Resize to the screen
  if(this._canvas.width != window.innerWidth || this._canvas.width != window.innerWidth){
	this._canvas.width = window.innerWidth;
    this._canvas.height = window.innerHeight;
	
    this.initializeStars();
  }
		//this._c.shadowBlur = 40;

	//this._c.shadowColor = "rgba(255, 255, 255, 0.97)";
	this._c.fillStyle = "rgba(18, 21, 22, 0.9)";
	this._c.fillRect(0,0, this._canvas.width, this._canvas.height);

	this._c.fillStyle = "rgba(200, 255, 255, 1)";
		  


  for(let i = 0; i < this._numStars; i++){
    this._star = this._stars[i];
	
  
    pixelX = (this._star.x - this._centerX) * (this._focalLength / this._star.z);
    pixelX += this._centerX;
    pixelY = (this._star.y - this._centerY) * (this._focalLength / this._star.z);
    pixelY += this._centerY;
    pixelRadius = this._radius * (this._focalLength / this._star.z);
    
    this._c.beginPath();
    this._c.arc(pixelX, pixelY, pixelRadius, 0, 2 * Math.PI);
    this._c.fill();
  }
}
  
}


const forntCommController = {};
forntCommController.instance = new FrontComunicationController();

const bingo = {};
const homepage = {};
const privacyPolicy = {};
const register ={};
const logining ={};

const cookieController = {};
cookieController.instance = new CookieController('documentCookie',30);

const user = {};
user.instance = new UserController('gost',0,'ne','naslovna','01234567899876543210','https://blazingsun.space/naslovna','Naslovna | Blazing Sun');


console.log('test 33003555555555555555555555')



const eventController = {};
eventController.instance = new EventController();



const tokenController = {};
tokenController.instance = new TokenController();

const glavniSablon = {};
glavniSablon.instance = new BuildController();

const url = {};
url.instance = new UrlController('naslovna', 'Naslovna | Blazing Sun','https://blazingsun.space/naslovna');	

const page = {};
page.instance = new PageController();


window.svemir = {};
svemir.instance = new Svemir(160,1,150);

(function() {
    var link = document.querySelector("link[rel*='icon']") || document.createElement('link');
    link.type = 'image/x-icon';
    link.rel = 'shortcut icon';
    link.href = 'https://blazingsun.space/assets/images/blazingSun.svg';
    document.getElementsByTagName('head')[0].appendChild(link);
})();