export const CALI_MEDIA_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

export const CALI_AREAS = [
  { id: 'solo', name: 'Solo', color: '#4dd6ff', tagline: 'Empurrar, equilibrar e dominar o chão.' }
];

export const MOBI_AREAS = [
  { id: 'mobilidade', name: 'Mobilidade', color: '#b197fc', tagline: 'Amplitude e controle articular para treinar melhor e sem dor.' }
];

export const MODE_AREAS = {
  cali: CALI_AREAS,
  mobi: MOBI_AREAS
};

export const CALI_LEVELS = {
  iniciante: 'Iniciante',
  intermediario: 'Intermediário',
  avancado: 'Avançado'
};

export const CALI_SKILLS = [
  {
    id: 'flexoes',
    muscles: { prim: ['Peito'], sec: ['Tríceps', 'Ombro Anterior', 'Core'] },
    area: 'solo',
    emoji: '💪',
    name: 'Flexões',
    alias: 'Push-up',
    level: 'iniciante',
    summary: 'Do apoio inclinado até a flexão arqueiro, com aumento gradual da carga sobre os braços.',
    prereq: null,
    steps: [
      {
        id: 'incline-pushup',
        img: 'Incline_Push-Up',
        frames: [0, 1],
        name: 'Flexão Inclinada',
        alias: 'Incline push-up',
        mode: 'reps',
        goal: { sets: 3, value: 12 },
        cues: [
          'Mãos em um banco ou na parede, com o corpo em linha reta dos pés à cabeça.',
          'Desça o peito até quase encostar, com os cotovelos a cerca de 45° do tronco.',
          'Empurre de volta sem deixar o quadril cair.'
        ],
        tip: 'Quanto mais alta a superfície, mais fácil. Reduza a altura aos poucos.'
      },
      {
        id: 'pushup',
        img: 'Pushups',
        frames: [0, 1],
        name: 'Flexão Padrão',
        alias: 'Push-up',
        mode: 'reps',
        goal: { sets: 3, value: 12 },
        cues: [
          'Mãos abaixo dos ombros e corpo em prancha.',
          'Desça até o peito quase tocar o chão.',
          'Estenda os cotovelos por completo no topo.'
        ],
        tip: 'Contraia abdômen e glúteos para manter o corpo alinhado durante toda a série.'
      },
      {
        id: 'decline-pushup',
        img: 'Push-Ups_With_Feet_Elevated',
        frames: [0, 1],
        name: 'Flexão Declinada',
        alias: 'Decline push-up',
        mode: 'reps',
        goal: { sets: 3, value: 10 },
        cues: [
          'Pés apoiados em um banco ou degrau.',
          'Mantenha o corpo reto, sem empinar o quadril.',
          'Desça com controle e empurre com força.'
        ],
        tip: 'A altura dos pés aumenta a carga nos ombros. Comece com um degrau baixo.'
      },
      {
        id: 'archer-pushup',
        name: 'Flexão Arqueiro',
        alias: 'Archer push-up, por lado',
        mode: 'reps',
        goal: { sets: 3, value: 6 },
        cues: [
          'Mãos bem afastadas, mais que a largura dos ombros.',
          'Desça sobre uma mão enquanto o outro braço fica estendido ao lado.',
          'Empurre de volta e alterne os lados.'
        ],
        tip: 'Conte as repetições por lado. Se um lado for mais fraco, ele define o valor da série.'
      }
    ]
  },
  {
    id: 'core',
    muscles: { prim: ['Abdômen'], sec: ['Oblíquos', 'Flexores do Quadril'] },
    area: 'solo',
    emoji: '🔥',
    name: 'Core',
    alias: 'Barquinho e estabilização',
    level: 'iniciante',
    summary: 'Do controle de lombar até a elevação de pernas, construindo o abdômen que sustenta L-Sit, Elbow Lever e Front Lever.',
    prereq: null,
    steps: [
      {
        id: 'dead-bug',
        img: 'Dead_Bug',
        frames: [0, 1],
        name: 'Dead Bug',
        alias: 'Inseto morto',
        mode: 'reps',
        goal: { sets: 3, value: 12 },
        cues: [
          'Deitado de costas, braços esticados para o teto e joelhos dobrados a 90° no ar.',
          'Estenda um braço atrás da cabeça e a perna oposta ao mesmo tempo, sem tirar a lombar do chão.',
          'Volte ao centro com controle e alterne o lado.'
        ],
        tip: 'A lombar não pode descolar do chão em nenhum momento. Se descolar, reduza a amplitude do braço e da perna.'
      },
      {
        id: 'plank-core',
        img: 'Plank',
        frames: [1],
        name: 'Prancha',
        alias: 'Plank',
        mode: 'time',
        goal: { sets: 3, value: 40 },
        cues: [
          'Antebraços no chão, cotovelos abaixo dos ombros, corpo reto dos pés à cabeça.',
          'Contraia abdômen e glúteos, sem deixar o quadril subir ou cair.',
          'Respire normalmente durante toda a série.'
        ],
        tip: 'Quadril caído tira a tensão do abdômen e sobrecarrega a lombar. Se não aguentar reto, reduza o tempo mas nunca a postura.'
      },
      {
        id: 'boat-hold',
        name: 'Barquinho',
        alias: 'Boat pose',
        mode: 'time',
        goal: { sets: 3, value: 20 },
        cues: [
          'Sentado, incline o tronco para trás e eleve as pernas dobradas, formando um V com o corpo.',
          'Braços estendidos à frente, na altura dos joelhos.',
          'Mantenha as costas retas, sem arredondar, e o peito aberto.'
        ],
        tip: 'Quanto mais estendidas as pernas, mais difícil. Comece com os joelhos bem dobrados e vá esticando aos poucos.'
      },
      {
        id: 'v-up',
        img: 'Jackknife_Sit-Up',
        frames: [0, 1],
        name: 'V-Up',
        alias: 'Barquinho dinâmico',
        mode: 'reps',
        goal: { sets: 3, value: 12 },
        cues: [
          'Deitado de costas, pernas e braços estendidos.',
          'Suba o tronco e as pernas ao mesmo tempo, tocando as mãos nos pés no alto, formando um V.',
          'Desça com controle até quase encostar no chão, sem relaxar o abdômen.'
        ],
        tip: 'Se não conseguir tocar os pés, suba até onde conseguir manter o movimento controlado. A descida lenta é o que mais desenvolve força.'
      },
      {
        id: 'lying-leg-raise',
        img: 'Flat_Bench_Lying_Leg_Raise',
        frames: [0, 1],
        name: 'Elevação de Pernas Deitado',
        alias: 'Lying leg raise',
        mode: 'reps',
        goal: { sets: 3, value: 15 },
        cues: [
          'Deitado de costas, mãos ao lado do corpo ou embaixo do quadril, pernas estendidas e juntas.',
          'Eleve as pernas até formarem 90° com o tronco, sem usar embalo.',
          'Desça devagar até quase tocar o chão, sem deixar a lombar arquear.'
        ],
        tip: 'Prepara exatamente o padrão de força usado no L-Sit e no Front Lever: elevar e controlar as pernas com a lombar estável.'
      }
    ]
  },
  {
    id: 'elbow-lever',
    muscles: { prim: ['Ombros', 'Core'], sec: ['Tríceps', 'Punhos e Antebraços'] },
    area: 'solo',
    emoji: '🐸',
    name: 'Elbow Lever',
    alias: 'Alavanca de cotovelo',
    level: 'iniciante',
    summary: 'Progressão até o equilíbrio horizontal apoiado só nas mãos. Toque no último passo para ver a técnica completa.',
    prereq: null,
    steps: [
      {
        id: 'frog-stand',
        name: 'Frog Stand',
        alias: 'Posição de sapo',
        mode: 'time',
        goal: { sets: 3, value: 20 },
        cues: [
          'Mãos no chão na largura dos ombros, com os dedos abertos.',
          'Apoie a parte interna dos joelhos na parte de trás dos braços, perto dos cotovelos.',
          'Incline o tronco para a frente até os pés saírem do chão e sustente respirando.'
        ],
        tip: 'Olhe para um ponto no chão à frente, não para os pés. Nas primeiras tentativas, use um colchonete na frente do rosto.'
      },
      {
        id: 'tuck-elbow-lever',
        name: 'Tuck Elbow Lever',
        alias: 'Grupado',
        mode: 'time',
        goal: { sets: 3, value: 15 },
        cues: [
          'Mãos com os dedos apontando para os lados ou levemente para trás.',
          'Encaixe os cotovelos no abdômen, um de cada lado, perto do quadril.',
          'Incline o corpo até o tronco ficar paralelo ao chão, com os joelhos dobrados junto ao peito.'
        ],
        tip: 'Os cotovelos ficam fixos no abdômen como um apoio. Se escorregarem, aproxime-os mais do quadril.'
      },
      {
        id: 'adv-tuck-elbow-lever',
        name: 'Advanced Tuck Elbow Lever',
        alias: 'Grupado avançado',
        mode: 'time',
        goal: { sets: 3, value: 12 },
        cues: [
          'A partir do tuck, afaste um pouco os joelhos do peito.',
          'Mantenha as costas retas e o corpo paralelo ao chão.',
          'Olhar à frente e respiração contínua.'
        ],
        tip: 'Estenda o quadril aos poucos. Ganhar 1 segundo por sessão já é uma ótima evolução.'
      },
      {
        id: 'one-leg-elbow-lever',
        name: 'One Leg Elbow Lever',
        alias: 'Uma perna estendida',
        mode: 'time',
        goal: { sets: 3, value: 10 },
        cues: [
          'Estenda uma perna alinhada ao corpo e mantenha a outra dobrada.',
          'Corpo paralelo ao chão e cotovelos firmes no abdômen.',
          'Alterne a perna estendida a cada série.'
        ],
        tip: 'Registre o menor tempo entre os dois lados. Assim os dois evoluem juntos.'
      },
      {
        id: 'elbow-lever-full',
        name: 'Elbow Lever',
        alias: 'Completo',
        mode: 'time',
        goal: { sets: 3, value: 10 },
        cues: [
          'Equilíbrio horizontal apoiado só nas mãos, com os cotovelos fixos no abdômen.',
          'Pernas estendidas e juntas, com o corpo em linha reta paralela ao chão.',
          'Cotovelos fixos no abdômen e o peso à frente das mãos.',
          'Ponta dos pés esticada e olhar à frente.'
        ],
        tip: 'Aqueça bem os punhos antes de cada treino, porque eles recebem muita carga. Se o quadril cair, volte um passo: manter o corpo reto vale mais que segurar por mais tempo. Essa skill ensina a levar o peso do corpo para a frente das mãos e abre caminho para skills como o planche.'
      }
    ]
  },
  {
    id: 'l-sit',
    muscles: { prim: ['Abdômen', 'Flexores do Quadril'], sec: ['Tríceps', 'Ombros'] },
    area: 'solo',
    emoji: '🧘',
    name: 'L-Sit',
    alias: 'Vela sentada',
    level: 'intermediario',
    summary: 'Sustentar o corpo com as pernas estendidas à frente, formando um L. Constrói abdômen, flexores de quadril e tríceps ao mesmo tempo.',
    prereq: 'Aqueça bem os punhos e ombros antes de treinar, e evite se os punhos estiverem doloridos.',
    steps: [
      {
        id: 'support-hold',
        img: 'Parallel_Bar_Dip',
        frames: [1],
        name: 'Support Hold',
        alias: 'Apoio em L neutro',
        mode: 'time',
        goal: { sets: 3, value: 20 },
        cues: [
          'Sente-se com as pernas à frente, mãos apoiadas ao lado do quadril, dedos apontando para a frente.',
          'Empurre o chão para longe e eleve o quadril até tirar o corpo do chão.',
          'Ombros para baixo, longe das orelhas, e olhar à frente.'
        ],
        tip: 'Use paralelas, cadeiras ou blocos se faltar espaço para as mãos. O objetivo aqui é só tirar o quadril do chão com os braços travados.'
      },
      {
        id: 'tuck-l-sit',
        name: 'Tuck L-Sit',
        alias: 'Grupado',
        mode: 'time',
        goal: { sets: 3, value: 15 },
        cues: [
          'A partir do support hold, leve os joelhos ao peito, mantendo os pés fora do chão.',
          'Costas retas, ombros para baixo e braços travados.',
          'Abdômen contraído para não deixar o quadril balançar.'
        ],
        tip: 'Se ainda não conseguir tirar os dois pés do chão juntos, tire um de cada vez até ganhar força.'
      },
      {
        id: 'one-leg-l-sit',
        name: 'One Leg L-Sit',
        alias: 'Uma perna estendida',
        mode: 'time',
        goal: { sets: 3, value: 12 },
        cues: [
          'Estenda uma perna à frente na altura do quadril, mantendo a outra dobrada junto ao peito.',
          'Braços travados e ombros para baixo o tempo todo.',
          'Alterne a perna estendida a cada série.'
        ],
        tip: 'Registre o menor tempo entre os dois lados, assim os dois evoluem juntos antes de tentar o L-Sit completo.'
      },
      {
        id: 'l-sit-full',
        name: 'L-Sit',
        alias: 'Completo',
        mode: 'time',
        goal: { sets: 3, value: 10 },
        cues: [
          'As duas pernas estendidas à frente, na altura do quadril, formando um L com o tronco.',
          'Braços completamente travados, ombros para baixo e longe das orelhas.',
          'Ponta dos pés esticada e abdômen firme o tempo todo.'
        ],
        tip: 'Flexibilidade de posterior de coxa ajuda bastante aqui. Alongar essa região nos dias de descanso acelera o progresso.'
      }
    ]
  },
  {
    id: 'mobilidade-ombro',
    short: 'Ombro',
    muscles: { prim: ['Ombros'], sec: ['Escápulas', 'Peitoral'] },
    area: 'mobilidade',
    emoji: '🔄',
    name: 'Mobilidade de Ombro',
    alias: 'Amplitude para empurrar e puxar sem dor',
    level: 'iniciante',
    summary: 'Movimentos ativos, sem elástico, para ganhar amplitude de ombro em todas as direções. Base para flexões, parada de mão e qualquer puxada.',
    prereq: 'Sem pressa: mobilidade se ganha com repetição frequente, não com força. Pare se sentir dor aguda, apenas desconforto leve é esperado.',
    steps: [
      {
        id: 'arm-circles',
        img: 'Arm_Circles',
        frames: [0, 1],
        name: 'Rotação de Braço Livre',
        alias: 'Arm circles',
        mode: 'reps',
        goal: { sets: 1, value: 15 },
        cues: [
          'Em pé, braços estendidos para os lados na altura dos ombros.',
          'Faça círculos amplos com os braços, aumentando o raio a cada repetição.',
          'Depois de metade das repetições, inverta o sentido do círculo.'
        ],
        tip: 'Aquecimento simples e rápido para soltar a articulação antes de qualquer treino de push ou pull.'
      },
      {
        id: 'arm-scaption-raise',
        img: 'Dumbbell_Scaption',
        frames: [0, 1],
        name: 'Elevação em Y',
        alias: 'Scaption sem carga',
        mode: 'reps',
        goal: { sets: 2, value: 12 },
        cues: [
          'Em pé, incline levemente o tronco à frente.',
          'Eleve os braços estendidos formando um Y acima da cabeça, polegares para cima.',
          'Desça com controle até a lateral do corpo.'
        ],
        tip: 'Trabalha a rotação externa e a elevação completa do ombro, essencial para travar os braços em cima na parada de mão.'
      },
      {
        id: 'sleeper-stretch',
        name: 'Rotação Interna Deitado',
        alias: 'Sleeper stretch',
        mode: 'time',
        goal: { sets: 2, value: 30 },
        cues: [
          'Deitado de lado, braço de baixo estendido à frente com o cotovelo dobrado a 90°.',
          'Use a outra mão para levar o antebraço em direção ao chão, sem tirar o ombro do lugar.',
          'Segure sentindo o alongamento atrás do ombro, depois troque de lado.'
        ],
        tip: 'Rotação interna limitada é uma das causas mais comuns de dor no ombro em quem treina calistenia.'
      },
      {
        id: 'wall-slide',
        name: 'Wall Slide',
        alias: 'Deslize na parede',
        mode: 'reps',
        goal: { sets: 2, value: 12 },
        cues: [
          'Costas, cabeça e braços encostados na parede, cotovelos dobrados a 90° como um W.',
          'Deslize os braços para cima até quase esticar, mantendo tudo encostado na parede.',
          'Desça controlado de volta à posição inicial.'
        ],
        tip: 'Se não conseguir manter os braços colados na parede o tempo todo, é sinal de que a mobilidade ainda está travada ali. Vá até onde conseguir manter o contato.'
      },
      {
        id: 'shoulder-dislocate-stick',
        name: 'Passagem de Bastão',
        alias: 'Stick dislocate',
        mode: 'reps',
        goal: { sets: 2, value: 10 },
        cues: [
          'Segure um cabo de vassoura ou toalha esticada com as duas mãos, bem afastadas.',
          'Sem dobrar os cotovelos, leve o bastão por cima da cabeça até atrás das costas.',
          'Volte para a frente com controle, sempre com os braços esticados.'
        ],
        tip: 'É o teste completo de amplitude do ombro. Comece com a pegada bem aberta; conforme melhora, vá fechando um pouco a cada semana, sem forçar dor.'
      }
    ]
  },
  {
    id: 'mobilidade-punho-cotovelo',
    short: 'Punho',
    muscles: { prim: ['Punhos e Antebraços'], sec: ['Cotovelos'] },
    area: 'mobilidade',
    emoji: '✊',
    name: 'Mobilidade de Punho e Cotovelo',
    alias: 'Proteção para apoios e flexões',
    level: 'iniciante',
    summary: 'Prepara punhos e antebraços para suportar o peso do corpo em flexões, elbow lever e parada de mão, prevenindo a dor que mais tira gente da calistenia.',
    prereq: 'Faça sempre antes de qualquer treino de calistenia que envolva apoiar as mãos no chão.',
    steps: [
      {
        id: 'wrist-circles-floor',
        name: 'Círculos de Punho no Chão',
        alias: 'Wrist circles',
        mode: 'reps',
        goal: { sets: 1, value: 10 },
        cues: [
          'Apoie as mãos no chão como numa prancha, dedos apontando para a frente.',
          'Faça círculos com o peso apoiado nos punhos, nos dois sentidos.',
          'Repita apontando os dedos para os lados e depois para trás do corpo.'
        ],
        tip: 'Três direções de dedo cobrem os ângulos que punho sente em flexões, parada de mão e elbow lever.'
      },
      {
        id: 'wrist-rock-back',
        img: 'Kneeling_Forearm_Stretch',
        frames: [0, 1],
        name: 'Balanço de Peso no Punho',
        alias: 'Weight shifting',
        mode: 'reps',
        goal: { sets: 1, value: 12 },
        cues: [
          'Mãos no chão em prancha, cotovelos travados.',
          'Balance o peso do corpo lentamente para frente, sentindo o punho estender.',
          'Volte para trás sentindo o punho flexionar, sem tirar a palma do chão.'
        ],
        tip: 'Prepara exatamente a amplitude usada na parada de mão, onde o punho fica em extensão máxima sustentando o peso todo.'
      },
      {
        id: 'wrist-flexor-stretch',
        img: 'Kneeling_Forearm_Stretch',
        frames: [0, 1],
        name: 'Alongamento de Flexores do Punho',
        alias: 'Palma para cima',
        mode: 'time',
        goal: { sets: 2, value: 20 },
        cues: [
          'Estenda um braço à frente com a palma da mão para cima.',
          'Use a outra mão para puxar os dedos suavemente em direção ao corpo.',
          'Segure, solte, depois troque de braço.'
        ],
        tip: 'Alongar antes e depois do treino ajuda a evitar a tendinite tão comum em quem começa a treinar apoiado nas mãos.'
      },
      {
        id: 'forearm-plank-rock',
        name: 'Prancha em Punho Fechado',
        alias: 'Fist plank rock',
        mode: 'time',
        goal: { sets: 2, value: 20 },
        cues: [
          'Apoie as mãos fechadas (nós dos dedos) no chão como uma prancha.',
          'Balance o corpo levemente para frente e para trás, mantendo o punho neutro.',
          'Mantenha o abdômen firme durante todo o tempo.'
        ],
        tip: 'Alivia a pressão direta sobre o punho enquanto ainda fortalece a estabilidade da articulação. Bom para dias em que o punho está mais sensível.'
      }
    ]
  },
  {
    id: 'mobilidade-coluna',
    short: 'Coluna',
    muscles: { prim: ['Coluna Torácica', 'Lombar'], sec: ['Core'] },
    area: 'mobilidade',
    emoji: '🌀',
    name: 'Mobilidade de Coluna',
    alias: 'Torácica e lombar em movimento',
    level: 'iniciante',
    summary: 'Movimentos que devolvem rotação e extensão à coluna torácica e aliviam a lombar, base para postura, parada de mão e front lever.',
    prereq: 'Movimente-se sempre devagar e dentro do conforto, sem travas nem dor aguda.',
    steps: [
      {
        id: 'cat-camel',
        img: 'Cat_Stretch',
        frames: [0, 1],
        name: 'Gato-Camelo',
        alias: 'Cat-camel',
        mode: 'reps',
        goal: { sets: 1, value: 12 },
        cues: [
          'De quatro apoios, mãos sob os ombros e joelhos sob o quadril.',
          'Arredonde a coluna toda para cima como um gato, olhando para o umbigo.',
          'Inverta levando o peito à frente e o umbigo em direção ao chão, olhando para cima.'
        ],
        tip: 'Movimente-se sentindo vértebra por vértebra, é a base de toda mobilidade de coluna.'
      },
      {
        id: 'thoracic-rotation-quadruped',
        name: 'Rotação Torácica Ajoelhado',
        alias: 'Thread the needle',
        mode: 'reps',
        goal: { sets: 1, value: 10 },
        cues: [
          'De quatro apoios, leve uma mão atrás da nuca.',
          'Gire o tronco abrindo o cotovelo em direção ao teto, olhando para a mão.',
          'Volte e "enfie" o mesmo cotovelo por baixo do corpo, girando para o outro lado.'
        ],
        tip: 'Rotação torácica limitada é uma das causas de dor lombar e de ombro travado. Alterne os lados a cada sessão.'
      },
      {
        id: 'open-book-stretch',
        img: 'Side-Lying_Floor_Stretch',
        frames: [0, 1],
        name: 'Abertura de Livro',
        alias: 'Open book',
        mode: 'time',
        goal: { sets: 1, value: 20 },
        cues: [
          'Deitado de lado, joelhos dobrados à frente do corpo, braços estendidos e juntos à frente.',
          'Abra o braço de cima como um livro, girando o tronco até quase encostar no chão do outro lado.',
          'Siga a mão com o olhar, segure e volte, depois troque de lado.'
        ],
        tip: 'Excelente para quem passa o dia sentado com o tronco fechado para a frente.'
      },
      {
        id: 'cobra-extension',
        name: 'Extensão em Cobra',
        alias: 'Cobra press',
        mode: 'time',
        goal: { sets: 2, value: 20 },
        cues: [
          'Deitado de bruços, mãos no chão na altura do peito.',
          'Empurre o chão elevando o tronco, mantendo o quadril colado no chão.',
          'Deixe a cabeça acompanhar o movimento olhando para cima, sem forçar o pescoço.'
        ],
        tip: 'Extensão de coluna direta, contrapõe todas as horas do dia com a coluna curvada para a frente.'
      }
    ]
  },
  {
    id: 'mobilidade-quadril',
    short: 'Quadril',
    muscles: { prim: ['Quadril'], sec: ['Glúteos', 'Adutores'] },
    area: 'mobilidade',
    emoji: '🦵',
    name: 'Mobilidade de Quadril',
    alias: 'Amplitude para agachar e sentar no chão',
    level: 'iniciante',
    summary: 'Movimentos ativos para destravar o quadril em todas as direções, melhorando agachamento, passada e conforto para sentar no chão.',
    prereq: 'Se algum joelho incomodar, use um travesseiro ou toalha dobrada embaixo dele como apoio.',
    steps: [
      {
        id: 'hip-90-90-flow',
        name: '90/90 de Quadril',
        alias: 'Troca de lado',
        mode: 'reps',
        goal: { sets: 2, value: 8 },
        cues: [
          'Sente no chão com uma perna dobrada à frente a 90° e a outra dobrada atrás a 90°.',
          'Mantenha o tronco ereto e incline levemente à frente sobre a perna da frente.',
          'Troque de lado girando o quadril, sem usar as mãos para se apoiar.'
        ],
        tip: 'Cobre rotação interna e externa do quadril ao mesmo tempo. O importante é o giro controlado, não a velocidade.'
      },
      {
        id: 'deep-squat-rock',
        img: 'Bodyweight_Squat',
        frames: [0, 1],
        name: 'Agachamento Profundo com Balanço',
        alias: 'Deep squat rock',
        mode: 'time',
        goal: { sets: 2, value: 30 },
        cues: [
          'Agache o mais fundo que conseguir, pés na largura dos ombros.',
          'Use os cotovelos para empurrar levemente os joelhos para fora.',
          'Balance o peso de um lado para o outro, mantendo os calcanhares no chão.'
        ],
        tip: 'Se o calcanhar levantar, apoie-o sobre um livro ou peso no início até ganhar amplitude de tornozelo e quadril.'
      },
      {
        id: 'world-greatest-stretch',
        img: 'Worlds_Greatest_Stretch',
        frames: [0, 1],
        name: 'Passada com Rotação',
        alias: "World's greatest stretch",
        mode: 'reps',
        goal: { sets: 2, value: 6 },
        cues: [
          'Dê um passo à frente longo, joelho de trás apoiado no chão.',
          'Apoie as duas mãos dentro do pé da frente, quadril empurrado para baixo.',
          'Gire o tronco erguendo um braço ao teto, olhando para a mão, depois troque de lado.'
        ],
        tip: 'Um movimento só que alonga flexor de quadril, abre o tronco e ainda mobiliza o tornozelo da frente.'
      },
      {
        id: 'standing-hip-circle',
        img: 'Standing_Hip_Circles',
        frames: [0, 1],
        name: 'Círculo de Quadril em Pé',
        alias: 'Hip CARs',
        mode: 'reps',
        goal: { sets: 1, value: 8 },
        cues: [
          'Em pé apoiado em uma parede ou cadeira, eleve um joelho à frente do corpo.',
          'Gire o joelho para o lado, para trás e volte ao centro, desenhando um círculo bem grande.',
          'Mantenha o tronco parado, só o quadril se move. Repita e troque de lado.'
        ],
        tip: 'Movimento de controle ativo: force a articulação a usar toda a amplitude disponível, não apenas relaxar nela.'
      }
    ]
  },
  {
    id: 'mobilidade-posterior-tornozelo',
    short: 'Posterior',
    muscles: { prim: ['Posterior de Coxa', 'Tornozelos'], sec: ['Panturrilha'] },
    area: 'mobilidade',
    emoji: '🦶',
    name: 'Mobilidade de Posterior e Tornozelo',
    alias: 'Cadeia posterior e base de apoio',
    level: 'iniciante',
    summary: 'Ganha amplitude de posterior de coxa e tornozelo, essencial para agachamento profundo, L-sit e aterrissagem de saltos com segurança.',
    prereq: 'Vá até sentir tensão leve, nunca dor aguda atrás do joelho ou na panturrilha.',
    steps: [
      {
        id: 'ankle-rock-knee',
        name: 'Mobilidade de Tornozelo',
        alias: 'Ankle rock',
        mode: 'reps',
        goal: { sets: 2, value: 10 },
        cues: [
          'Fique de joelhos com um pé apoiado à frente, como um afundo.',
          'Leve o joelho da frente para além da ponta do pé, sem levantar o calcanhar do chão.',
          'Volte e repita, depois troque de lado.'
        ],
        tip: 'Tornozelo travado atrapalha o agachamento profundo e a aterrissagem em saltos. Poucos minutos por dia já fazem diferença.'
      },
      {
        id: 'standing-hamstring-sweep',
        name: 'Varredura de Posterior em Pé',
        alias: 'Standing hamstring sweep',
        mode: 'reps',
        goal: { sets: 2, value: 10 },
        cues: [
          'Em pé, apoie um calcanhar à frente com a perna esticada e os dedos do pé para cima.',
          'Dobre o quadril inclinando o tronco à frente, mantendo as costas retas.',
          'Suba e desça com controle, sem arredondar a coluna, depois troque de perna.'
        ],
        tip: 'Versão dinâmica do alongamento de posterior: junta ganho de amplitude com controle ativo do movimento.'
      },
      {
        id: 'toe-touch-active',
        img: 'Standing_Toe_Touches',
        frames: [0, 1],
        name: 'Toque no Pé Ativo',
        alias: 'Active toe touch',
        mode: 'time',
        goal: { sets: 2, value: 20 },
        cues: [
          'Em pé, pernas retas e juntas, incline o tronco à frente buscando tocar os pés.',
          'Contraia o quadríceps para ajudar a soltar o posterior de coxa.',
          'Desça só até onde conseguir manter as pernas travadas, sem dobrar os joelhos.'
        ],
        tip: 'Contrair a frente da coxa enquanto alonga o posterior acelera o ganho de amplitude comparado a só relaxar no alongamento.'
      },
      {
        id: 'calf-stretch-wall',
        img: 'Calf_Stretch_Hands_Against_Wall',
        frames: [0, 1],
        name: 'Alongamento de Panturrilha',
        alias: 'Na parede',
        mode: 'time',
        goal: { sets: 2, value: 30 },
        cues: [
          'Mãos apoiadas na parede, uma perna à frente dobrada e a outra estendida atrás.',
          'Mantenha o calcanhar de trás no chão e o pé apontando para a frente.',
          'Incline o corpo em direção à parede até sentir o alongamento na panturrilha, depois troque de lado.'
        ],
        tip: 'Panturrilha curta é uma das causas mais comuns de calcanhar subir no agachamento profundo.'
      }
    ]
  }
];

export const CALI_STEP_LIST = CALI_SKILLS.flatMap(skill =>
  skill.steps.map((step, index) => Object.assign(step, { skillId: skill.id, area: skill.area, index }))
);

export const CALI_STEPS = Object.fromEntries(CALI_STEP_LIST.map(step => [step.id, step]));
export const CALI_SKILL_MAP = Object.fromEntries(CALI_SKILLS.map(skill => [skill.id, skill]));
export const CALI_AREA_MAP = Object.fromEntries([...CALI_AREAS, ...MOBI_AREAS].map(area => [area.id, area]));

export const MODE_SKILLS = {
  cali: CALI_SKILLS.filter(s => s.area !== 'mobilidade'),
  mobi: CALI_SKILLS.filter(s => s.area === 'mobilidade')
};

export const MODE_STEP_LIST = {
  cali: CALI_STEP_LIST.filter(step => step.area !== 'mobilidade'),
  mobi: CALI_STEP_LIST.filter(step => step.area === 'mobilidade')
};

export function fmtSeconds(total) {
  const s = Math.max(0, Math.round(total));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return r ? `${m}m${String(r).padStart(2, '0')}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm ? `${h}h${String(mm).padStart(2, '0')}m` : `${h}h`;
}

export function fmtShort(step, value) {
  return step.mode === 'time' ? fmtSeconds(value) : String(value);
}

export function fmtValue(step, value) {
  if (step.mode === 'time') return fmtSeconds(value);
  return `${value} ${value === 1 ? 'rep' : 'reps'}`;
}

export function fmtClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = String(m).padStart(2, '0');
  const rr = String(r).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${rr}` : `${mm}:${rr}`;
}

export function fmtStopwatch(seconds) {
  const s = Math.max(0, seconds);
  if (s < 60) return s.toFixed(1);
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r.toFixed(1).padStart(4, '0')}`;
}

export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function stepPhotos(step) {
  if (!step.img) return [];
  const frames = step.frames || [0, 1];
  return frames.map(frame => `${CALI_MEDIA_BASE}${step.img}/${frame}.jpg`);
}

export function tutorialUrl(step) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${step.name} tutorial calisthenics`)}`;
}