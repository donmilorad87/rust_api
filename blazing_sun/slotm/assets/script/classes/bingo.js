'use strict';
	
export default class Bingo {

constructor(iy1, iy2) {

    this.iy1 = iy1;
    this.iy2 = iy2;

 


	
  }
  
sortiraj(){
	 let mdd1= document.getElementById("section1");

	let targetDiv = document.getElementById("section1").getElementsByClassName("circle");
	let arr =[];
	
	for (let i=0; i <targetDiv.length; i++){
		
		arr.push(targetDiv[i].innerHTML);
	}
	arr.sort(function(a, b){return a - b});

	this.cleanElement("section1");

	
	for (let i = 0; i<arr.length; i++){
		let broj = document.createElement("div");
		broj.setAttribute("class", "circle");
		broj.setAttribute("onclick", "this.bingo.dodajBroj(this)");
		broj.innerHTML = arr[i];
		mdd1.appendChild(broj);
		
	}
}

dodajBroj(me) {
  let x = document.getElementsByClassName("numbersContainer");
  let y = document.getElementById('editField');

  
  

 

  
  
  me.setAttribute('onclick','this.bingo.obrisiBroj(this)');
if(y){
	
	y.parentNode.appendChild(me);

}


  
  
if(this.iy2==4){
	
	

			this.iy2=0;
		
			
			document.getElementById('section1').style.pointerEvents='none';
	
	if(y){
	
	y.parentNode.appendChild(me);

}else{
x[this.iy1].appendChild(me);
}
			
	
}
else{




	if(y){
	
	y.parentNode.appendChild(me);

}else{
x[this.iy1].appendChild(me);
}

this.iy2++;
}



}

editujTiket(me){
	this.iy1--;
		 let mdd1= document.getElementById("section1");
	  let mdd2= document.getElementById("section2");
	let button = document.getElementById("mainButton");

button.style.pointerEvents='none';

		

		
			let x = me.parentNode.getElementsByClassName('circle');
					for(let i=0;i<x.length;i++){
					 this.iy2++;
					 
				}
	

	
	mdd1.style.pointerEvents='all';



		button.setAttribute('style','display:none;');
	 
	let editButton = document.createElement("div");
			editButton.setAttribute("class", "button");
			editButton.setAttribute("id", "editButton");
			editButton.setAttribute('style','border:5px solid green; display:block;margin-top:1%;');
			editButton.setAttribute("onclick", "this.bingo.predajTiket()");
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
  
this.cleanElement("section1");

	for (let i = 0; i<arr2.length; i++){
		let broj = document.createElement("div");
		broj.setAttribute("class", "circle");
		broj.setAttribute("onclick", "this.bingo.dodajBroj(this)");
		broj.innerHTML = arr2[i];
		mdd1.appendChild(broj);
		
	}

}

obrisiBroj(me){


		

	
if(this.iy2 == 0){
	this.iy2=5;

		}
	
document.getElementById('section1').style.pointerEvents='all';

	  let kk =document.getElementById("section1");
	  kk.appendChild(me);
	  me.setAttribute('onclick','this.bingo.dodajBroj(this)');
			this.sortiraj();
	this.iy2--; 
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
button.setAttribute("onclick", "this.bingo.predajTiket()");
button.style.pointerEvents='all';
 var x = mdd4.getElementsByClassName("numbersContainer");
console.log(this.iy1);
		x[this.iy1].style.background= 'green';
		
		
		let xsym = document.createElement("span");
			xsym.setAttribute("class", "xsym");
			xsym.setAttribute("id", "xsym");
			xsym.setAttribute("onclick", "this.bingo.izbrisiTiket(this)");
			xsym.innerHTML = '&#10006;';
			xsym.style.pointerEvents='none';
			
		let esym = document.createElement("span");
			esym.setAttribute("class", "esym");
			esym.setAttribute("id", "esym");
			esym.setAttribute("onclick", "this.bingo.editujTiket(this)");
			esym.innerHTML = '&#9998;';
			esym.style.pointerEvents='none';		
		
		
		x[this.iy1].appendChild(xsym);
		x[this.iy1].appendChild(esym);

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
	



this.pripremiObjekat();


		
	
	
	
}

obnoviSablon() {
 this.iy1 = 0;
 this.iy2 = 0;

	this.napraviSablon(this.iy1,this.iy2);	


	




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
								novaIgraA.setAttribute("onclick", "this.bingo.obnoviSablon()");
								
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
									
									
							}	
						}	
			}  
	
	}, 1000*i);
  })(i,kezp,x);
		
	 }
	 
				
	
	
	
	
}

izbrisiTiket(me){
	this.iy1--; 
	me.parentElement.style.background ='white';
	me.parentElement.innerHTML='';
	
	let arr =[];
	
	
		
		let button = document.getElementById("mainButton");
			button.innerHTML='Dodaj Tiket';
			button.setAttribute("onclick", "this.bingo.dodajTiket()");
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
			
		
		let y= x[this.iy1].getElementsByClassName("circle");
	
		for(let j=0;j<y.length;j++){
			  
			y[j].setAttribute('style',' pointer-events: none;');
				
		
			
			
		}
			

	
			
		

		

		
		}
				
	}

	if(x[this.iy1].getElementsByClassName("circle")[0]){
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
    this.iy1++; 
	document.getElementById('section1').style.pointerEvents='none';
	
	let button = document.getElementById("mainButton");
		button.innerHTML='Dodaj tiket';
		button.setAttribute("onclick", "this.bingo.dodajTiket()");
		button.style.pointerEvents='all';
		this.iy2 = 0;
		this.cleanElement("section1");

		for(let i=0;i<30;i++){
			
			let broj = document.createElement("div");
			broj.setAttribute("class", "circle");
			broj.setAttribute("id", "lotoBroj"+ (i+1) +"");
			broj.setAttribute("onclick", "this.bingo.dodajBroj(this)");
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
		
		if(this.iy1 == 5){
				 (function IIFE(){	
			let button = document.getElementById("mainButton");
				button.innerHTML='Zapocni izvlacenje';
				button.setAttribute("onclick", "this.bingo.odigraj()");
				button.style.pointerEvents='all';
			
				
		
			
			 })();
		}

	}else{
		
	}
	
	 

	
}



napisiSistemKvota() {
	if(document.getElementById('kestenica')){
		this.removeElement('kestenica');
	}


		let bodty= document.getElementById('winwerDiv2');	

						
			
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

napraviSablon() {

   let bodty= document.getElementById('winwerDiv2');	

		

			
   if(document.getElementById('center')){
      var center= document.getElementById('center');
	  this.cleanElement("center");
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
	broj.setAttribute("onclick", "this.bingo.dodajBroj(this)");
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
	button.setAttribute("onclick", "this.bingo.dodajTiket()");
	section2.appendChild(button);


right.appendChild(section1);
right.appendChild(section2);

center.appendChild(left);
center.appendChild(right);

bodty.appendChild(center);			


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

  
}
