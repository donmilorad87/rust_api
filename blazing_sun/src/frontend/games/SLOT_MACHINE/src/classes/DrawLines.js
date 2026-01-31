'use strict';

export default class DrawLines {

    constructor() {
	
		
		this.c = document.getElementById("myCanvas");
        this.ctx = this.c.getContext("2d");
		this.width = this.c.offsetWidth;      
        this.c.setAttribute('height', document.getElementById('spinovi').offsetHeight)
        this.c.setAttribute('width', this.width)
		
        this.halfStep = ((document.getElementById('spinovi').offsetHeight / 3) / 2);
        this.middle = 3 * this.halfStep
        this.down = 5 * this.halfStep

        this.halfStepW = (this.width / 5) / 2;
		 this.ctx.lineWidth = 10;
        this.ctx.font = "20px Arial";
        this.ctx.strokeStyle = this.r
	
        this.linez = [1, 0, 0, 0, 0, 0, 0]
		this.jokerAdded = false
		this.dzoker = 0
        this.r = 'rgba(60, 0, 129, 0.4)';

        this.text = document.getElementById('igraDzoker')

        this.myVideoEndedHandler = this.myListener.bind(this);

        this.lining(document.getElementById('linije').getElementsByTagName('input'));

        this.jokerCheckboxEvent = this.dzokerChekBoxListener.bind(this);

        document.getElementById('joker').addEventListener('click', this.jokerCheckboxEvent)
    }

    dzokerChekBoxListener() {

        if (document.getElementById('joker').checked == true) {

            this.brojacKockica()
            this.brojacLinija()
            this.crtacKockica()
            document.getElementById('linije').style.display = 'none'

        } else {

            this.dzoker = 0
            this.mojBrisac()
            this.ocistiCanvas()
            this.lineCheck()

            document.getElementById('linije').style.display = 'block'

            if (document.getElementById('snimiDzokera')) {

                snimiDzokera.remove()

            }
        }

    }

	obrisiLiningEvents(x){
		
		for (let i = 0; i < x.length; i++) {
            x[i].onclick = null
			x[i].disabled = true
						
        }
		

		x[0].disabled = true
		x[1].disabled = true
		
	}
	
    lining(x) {
		let counter = 0;
		let pointer = 0;
		
        for (let i = 0; i < x.length; i++) {
            x[i].onclick = () => {
                this.lineCheckHelperFull(x[i])
            }
			if(x[i].checked){
				counter++
				pointer=i
			}
			
			
        }

		for (let i = 0; i < x.length; i++) {
		if(counter>1){

				x[i].disabled = false
			}else{
				if(i == pointer){

					x[i].disabled = true
				}else{

					x[i].disabled = false
				}
				
			}
		}
    }


    cekerZaLinijskeDzokere(x) {
        let mapaDzokera = [
            [2, 6],
            [2, 5],
            [2, 7],
            [2, 4],
            [2, 6],
            [1, 4, 5],
            [1, 6, 7],
            [1, 4, 5],
            [1, 6, 7],
            [1, 4, 5],
            [3, 7],
            [3, 4],
            [3, 6],
            [3, 5],
            [3, 7]
        ]
		

		
		
        for (let i = 0; i < mapaDzokera[this.dzoker - 1].length; i++) {
            if (mapaDzokera[this.dzoker - 1][i] === x) {
                this.pomocniNiz[i] = x
            }
        }

    }
	lineCheckHelperFull(x) {
		
		

	
		switch (parseInt(x.name)) {
		  case 0:
			this.lineCheckHelperFullHelper(x)
			break;
		  case 1:
			this.lineCheckHelperFullHelper(x)
			break;
		  case 2:
			this.lineCheckHelperFullHelper(x)
			break;
		  case 3:
			this.lineCheckHelperFullHelper(x)
			break;
		  case 4:
			this.lineCheckHelperFullHelper(x)
			break;
		  case 5:
			this.lineCheckHelperFullHelper(x)
			break;
		  case  6:
			this.lineCheckHelperFullHelper(x)
			break;
		}
		
		if (this.jokerAdded) {

            for (let i = 0; i < this.pomocniNiz.length; i++) {

                if (this.linez[this.pomocniNiz[i] - 1] === 0) {
                    this.pomocniNiz[i] = 0
                }

            }

            if (this.pomocniNiz.reduce((a, b) => a + b) === 0) {
                this.obrisiDzokera();
            } else {
                this.dodajDzokera(this.kkk1, this.kkk2)
            }

        }

        this.brojacLinija()	
		
	}
	
	lineCheckHelperFullHelper(x){

		if (!x.checked) {

                this.linez[x.name] = 0;

				x.parentElement.style.background = 'white'
				
                this.ocistiCanvas()
                this.lineCheck()

            } else {

                this.linez[x.name] = 1;

				x.parentElement.style.background = 'lightgreen'
				
				 this.nacrtajLiniju(parseInt(x.name))

                if (this.jokerAdded) {

                    this.cekerZaLinijskeDzokere(parseInt(x.name)+1)

                }
        }
	}
 

    brojacLinija() {

        let y = 0;

        this.linez.map(items => (items === 1) ? y++ : 0);

        if (y === 1) {
console.log('ovde smo333', parseInt(document.getElementById('igraUlog').textContent) + parseInt(document.getElementById('igraDzoker').textContent.match(/\d+/g).map(Number)[0]), parseInt(document.getElementById('igraUlog').textContent), parseInt(document.getElementById('igraDzoker').textContent.match(/\d+/g).map(Number)[0]))
            document.getElementById('linije').querySelector('input:checked').disabled = true
            document.getElementById('igraBrojLinija').textContent = 1
            document.getElementById('ukupanulog').textContent = parseInt(document.getElementById('igraUlog').textContent) + parseInt(document.getElementById('igraDzoker').textContent.match(/\d+/g).map(Number)[0])
        } else {
			
					console.log('nme mozemo biti ovde')
                document.getElementById('igraBrojLinija').textContent = y
                document.getElementById('ukupanulog').textContent = y *  parseInt(document.getElementById('igraUlog').textContent) +  parseInt(document.getElementById('igraDzoker').textContent.match(/\d+/g).map(Number)[0])
     
		
				if (document.getElementById('linije').querySelector('input:disabled')) {
					
					document.getElementById('linije').querySelector('input:disabled').disabled = false
				}
       

        }

       
            return y
        

    }




    brojacKockica() {

        this.kockice = new Array(15).fill(0);
		
		let x = document.getElementById('linije').getElementsByTagName('input');

		let niz = [
		[5,6,7,8,9],
		[0,1,2,3,4],
		[10,11,12,13,14],
		[3,5,7,9,11],
		[1,5,7,9,13],
		[0,4,6,8,12],
		[2,6,8,10,14]
		]
		
		for (let i = 0; i < 7; i++) {
			
			if (x[i].checked) {
				for (let j = 0; j < 5; j++) {
						this.kockice[niz[i][j]] = 1
                    }
			}
			
		}

    }

    crtacKockica() {
        this.ocistiCanvas();
        this.ctx.strokeStyle = '#3c0081';
        this.ctx.shadowColor = "black";
        this.ctx.shadowBlur = 18;
        this.ctx.shadowOffsetX = 0;
        this.ctx.shadowOffsetY = 0;

        for (let i = 0; i < 15; i++) {
            if (i > -1 && i < 5) {
                if (this.kockice[i] === 1) {

                    this.ctx.beginPath();

                    this.ctx.rect(0 + (this.halfStepW * 2 * i), 0, this.halfStepW * 2, (this.halfStep * 2));
                    this.ctx.stroke();
                }

            } else if (i > 4 && i < 10) {
                if (this.kockice[i] === 1) {
                    
					this.ctx.beginPath();

                    this.ctx.rect(0 + (this.halfStepW * 2 * (i - 5)), this.halfStep * 2, this.halfStepW * 2, this.halfStep * 2);
                    this.ctx.stroke();
                }
            } else {
                if (this.kockice[i] === 1) {
                    this.ctx.beginPath();

                    this.ctx.rect(0 + (this.halfStepW * 2 * (i - 10)), this.halfStep * 4, this.halfStepW * 2, this.halfStep * 2);
                    this.ctx.stroke();
                }
            }
        }

        this.ctx.shadowBlur = 0;
        this.crtacDzokera()
        this.ctx.strokeStyle = this.r

    }

    crtacDzokera() {

        this.c.addEventListener('click', this.myVideoEndedHandler);

    }

    mojBrisac() {

        this.c.removeEventListener('click', this.myVideoEndedHandler);

    }

    myListener(e) {

        const rect = this.c.getBoundingClientRect();

        const mousePos = {
            x: e.clientX - Math.floor(rect.left),
            y: e.clientY - Math.floor(rect.top)
        };


        let komer3 = mousePos.y / (2 * this.halfStep)

        let komer4 = mousePos.x / (this.halfStepW * 2)
		
		this.myListenerCaseHelper(komer3,komer4);
	

    }
	
	myListenerCaseHelper(x,y){
	
		let help;
		if(x > 0 && x < 1){
			help = 0
		}
		else if(x > 1 && x < 2){
			help = 1
		}
		else if(x > 2 && x < 3){
			help = 2
		}
		
		
		switch (help) {
			  case 0:

					this.myListenerCaseHelper2(y,0)
				break;
			  case 1:

					this.myListenerCaseHelper2(y,5)
				break;
			  case 2:

					this.myListenerCaseHelper2(y,10)
				break;
			}
					

	}
	
	myListenerCaseHelper2(x,y){
		let help;
		
		if(x > 0 && x < 1){
			help = 0
		}
		else if(x > 1 && x < 2){
			help = 1
		}
		else if(x > 2 && x < 3){
			help = 2
		}
		else if(x > 3 && x < 4){
			help = 3
		}
		else if(x > 4 && x < 5){
			help = 4
		}
		
		switch (help) {
			  case 0:
				help = help + y;
					this.myListenerCaseHelper3(help)
				break;
			  case 1:
				help = help + y;
					this.myListenerCaseHelper3(help)
				break;
			  case 2:
				help = help + y;
					this.myListenerCaseHelper3(help)
				break;
		      case 3:
				help = help + y;
					this.myListenerCaseHelper3(help)
				break;
			  case 4:
				help = help + y;
					this.myListenerCaseHelper3(help)
				break; 	
			}
		
	
		
	}
	
	myListenerCaseHelper3(x){


		let niz = [
		[0,0,1,(this.linez[1] > 0) ? 2 : 0, (this.linez[5] > 0) ? 6 : 0],
		[2 * this.halfStepW, 0, 2, (this.linez[1] > 0) ? 2 : 0, (this.linez[4] > 0) ? 5 : 0],
		[4 * this.halfStepW, 0, 3, (this.linez[1] > 0) ? 2 : 0, (this.linez[6] > 0) ? 7 : 0],
		[6 * this.halfStepW, 0, 4, (this.linez[1] > 0) ? 2 : 0, (this.linez[3] > 0) ? 4 : 0],
		[8 * this.halfStepW, 0, 5, (this.linez[1] > 0) ? 2 : 0, (this.linez[5] > 0) ? 6 : 0],
		[0, 2 * this.halfStep, 6, (this.linez[0] > 0) ? 1 : 0, (this.linez[3] > 0) ? 4 : 0, (this.linez[4] > 0) ? 5 : 0],
		[2 * this.halfStepW, 2 * this.halfStep, 7, (this.linez[0] > 0) ? 1 : 0, (this.linez[5] > 0) ? 6 : 0, (this.linez[6] > 0) ? 7 : 0],
		[4 * this.halfStepW, 2 * this.halfStep, 8, (this.linez[0] > 0) ? 1 : 0, (this.linez[3] > 0) ? 4 : 0, (this.linez[4] > 0) ? 5 : 0],
		[6 * this.halfStepW, 2 * this.halfStep, 9, (this.linez[0] > 0) ? 1 : 0, (this.linez[5] > 0) ? 6 : 0, (this.linez[6] > 0) ? 7 : 0],
		[8 * this.halfStepW, 2 * this.halfStep, 10, (this.linez[0] > 0) ? 1 : 0, (this.linez[3] > 0) ? 4 : 0, (this.linez[4] > 0) ? 5 : 0],
		[0, 4 * this.halfStep, 11, (this.linez[2] > 0) ? 3 : 0, (this.linez[6] > 0) ? 7 : 0],
		[2 * this.halfStepW, 4 * this.halfStep, 12, (this.linez[2] > 0) ? 3 : 0, (this.linez[3] > 0) ? 4 : 0],
		[4 * this.halfStepW, 4 * this.halfStep, 13, (this.linez[2] > 0) ? 3 : 0, (this.linez[5] > 0) ? 6 : 0],
		[6 * this.halfStepW, 4 * this.halfStep, 14, (this.linez[2] > 0) ? 3 : 0, (this.linez[4] > 0) ? 5 : 0],
		[8 * this.halfStepW, 4 * this.halfStep, 15, (this.linez[2] > 0) ? 3 : 0, (this.linez[6] > 0) ? 7 : 0 ],
	    ]
		
		


		
		
	
		
		if (this.kockice[x] === 1) {

                    if (this.dzoker !== (x+1)) {

                        this.ocistiCanvas()
                        this.crtacKockica()
                        this.pomocniNiz=[]

						for(let i=2; i<niz[x].length;i++){
							if(i === 2){
								this.dodajDzokera(niz[x][0], niz[x][1], niz[x][2])
							
								this.dzoker = niz[x][2]
							}else{
								this.pomocniNiz.push(niz[x][i]);
							}
							
						}
                    }
                }
	}
	
	
    dodajDzokera(x, y, z) {

        this.img.src = "data:image/png;base64,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"
        this.myloader2 = this.myOnloadPic.bind(this, x, y, z);

        this.img.addEventListener('load', this.myloader2);

    }

    obrisiDzokera() {
		
        this.text.textContent = " NE (0 $)";
        document.getElementById('ukupanulog').textContent = document.getElementById('igraBrojLinija').textContent * document.getElementById('igraUlog').textContent
       
        this.ocistiCanvas()
        this.lineCheck()
        this.dzoker = 0
		this.vrednostDzokera = 0
        izbrisiDzokera.remove()
        document.getElementById('joker').checked = false
        document.getElementById('joker').disabled = false

        this.jokerAdded = false

    }

    myOnloadPic(x, y, z) {
		
        this.kkk1 = x;
        this.kkk2 = y;
        let ke;
        let w = this.img.width;
        let h = this.img.height;

        let sizer = Math.min((2 * this.halfStepW / w), (2 * this.halfStep / h));

        if (this.halfStepW > this.halfStep) {
            ke = x + ((2 * this.halfStepW - this.img.width) / 2)
            this.ctx.drawImage(this.img, ke, y, w * sizer, h * sizer);
        } else {
            ke = y + ((2 * this.halfStep - this.img.width) / 2)
            this.ctx.drawImage(this.img, x, ke, w * sizer, h * sizer);
        }
		
		
		
		
        if (!document.getElementById('snimiDzokera')) {
				
            if (!document.getElementById('izbrisiDzokera')) {
		
                if (document.getElementById('joker').checked) {
                    let dugme = document.createElement('button')
						dugme.textContent = 'Snimi Dzokera'
						dugme.id = 'snimiDzokera'
						dugme.className = 'snimidzokeraklasa'
						jokerCont.appendChild(dugme);
					
					this.myloader3 = this.snimiDzokera.bind(this, z);
					
				
                    document.getElementById('snimiDzokera').addEventListener('click', this.myloader3);
                }
            }
        }

    }
		

    snimiDzokera(x) {
		
		
		this.dzoker = x
		this.vrednostDzokera = document.querySelector('input[name="bet"]:checked').value * 5
        this.text.textContent = " DA (" + (document.querySelector('input[name="bet"]:checked').value) * 5 + " $)";
        let xx = (document.querySelector('input[name="bet"]:checked').value) * 5
        document.getElementById('ukupanulog').textContent = document.getElementById('igraBrojLinija').textContent * document.querySelector('input[name="bet"]:checked').value + xx
        
		this.ocistiCanvas()
        this.lineCheck()
        this.dodajDzokera(this.kkk1, this.kkk2)
		

        document.getElementsByClassName('snimidzokeraklasa')[0].style.display = 'none'
        
		this.mojBrisac()
        this.jokerAdded = true

        let dugme = document.createElement('button')
        dugme.textContent = 'Izbrisi dzokera'
        dugme.id = 'izbrisiDzokera'

        jokerCont.appendChild(dugme);
        document.getElementById("joker").disabled = true
        document.getElementById('linije').style.display = 'block'

        setTimeout(() => {
            snimiDzokera.remove()
        }, 0)
		
		this.myloader4 = this.obrisiDzokera.bind(this);
		
        document.getElementById('izbrisiDzokera').addEventListener('click', this.myloader4);

    }

    lineCheck() {

	
	
        for (let i = 0; i < 7; i++) {

                if (this.linez[i] === 1) {
                    this.nacrtajLiniju(i)
                }
            
			
        }

    }


	
	nacrtajLiniju(x){
		

		
		let path = [
		[
			[[0, this.middle], [this.width, this.middle]],
			[[2 * this.halfStepW,  this.middle],[4 * this.halfStepW - 1,  this.middle],[6 * this.halfStepW - 1,  this.middle],[8 * this.halfStepW - 1,  this.middle]]
		],
		[
			[[0, this.halfStep],[this.width, this.halfStep]],
			[[2 * this.halfStepW,  this.halfStep],[4 * this.halfStepW - 1,  this.halfStep],[6 * this.halfStepW - 1,  this.halfStep],[8 * this.halfStepW - 1,  this.halfStep]]
		],
		[
			[[0, this.down],[this.width, this.down]],
			[[2 * this.halfStepW,  this.down],[4 * this.halfStepW - 1,  this.down],[6 * this.halfStepW - 1,  this.down],[8 * this.halfStepW - 1,  this.down]]]
		,
		[
			[[0, this.middle],[this.halfStepW, this.middle],[3 * this.halfStepW, this.down],[7 * this.halfStepW, this.halfStep],[9 * this.halfStepW, this.middle],[this.width, this.middle]],
			[[2 * this.halfStepW, this.middle + this.halfStep],[4 * this.halfStepW, this.middle + this.halfStep],[6 * this.halfStepW, this.middle - this.halfStep],[8 * this.halfStepW, this.middle - this.halfStep]]
		],
		[
			[[0, this.middle],[this.halfStepW, this.middle],[3 * this.halfStepW, this.halfStep],[7 * this.halfStepW, this.down],[9 * this.halfStepW, this.middle], [this.width, this.middle]],
			[[2 * this.halfStepW, this.middle - this.halfStep],[4 * this.halfStepW, this.middle - this.halfStep],[6 * this.halfStepW, this.middle + this.halfStep],[8 * this.halfStepW, this.middle + this.halfStep]]
		],
		[
			[[0, this.halfStep], [this.halfStepW, this.halfStep], [5 * this.halfStepW, this.down],[9 * this.halfStepW, this.halfStep],[this.width, this.halfStep]],
			[[this.halfStepW, this.halfStep],[3 * this.halfStepW, this.middle],[5 * this.halfStepW, this.down],[7 * this.halfStepW, this.middle],[9 * this.halfStepW, this.halfStep]]
		],
		[
			[[0, this.down], [this.halfStepW, this.down], [5 * this.halfStepW, this.halfStep], [9 * this.halfStepW, this.down], [this.width, this.down]],
			[[this.halfStepW, this.down], [3 * this.halfStepW, this.middle], [5 * this.halfStepW, this.halfStep],[7 * this.halfStepW, this.middle],[9 * this.halfStepW, this.down]]
		]
		]
		


		
		this.ctx.strokeStyle = this.r
        this.ctx.lineWidth = 10;
        this.ctx.beginPath();
		
		for(let i = 0; i<path[x][0].length; i++){
			if(i === 0){
				this.ctx.moveTo(path[x][0][i][0], path[x][0][i][1]);	
			}
			else{
				this.ctx.lineTo(path[x][0][i][0], path[x][0][i][1]);	
			}
		}
		
		this.ctx.stroke();
		
		
		
		
		for(let i = 0; i<path[x][1].length; i++){
			
			this.ctx.lineWidth = 1;
			this.ctx.beginPath();
			this.ctx.arc(path[x][1][i][0], path[x][1][i][1], 10, 0, 2 * Math.PI);
			this.ctx.fillStyle = 'white';
			this.ctx.fill();
			this.ctx.stroke()
			this.ctx.fillStyle = 'black';
			this.ctx.fillText(x+1, path[x][1][i][0] - 6, path[x][1][i][1] + 7);
			
			
		}

		this.ctx.lineWidth = 10;
       
	} 


    ocistiCanvas() {
		

        this.ctx.clearRect(0, 0, this.c.width, this.c.height);
        this.img = new Image();
    }

}