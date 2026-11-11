// Catálogo de exercícios para montar treinos: grupo, músculos (nomes que o mapa
// do corpo conhece, ver REGION_NAMES em body-map.js), dica, foto
// (free-exercise-db) e tipo de registro:
//   load  carga × repetições (padrão)
//   reps  só repetições (peso do corpo)
//   time  tempo em segundos (pranchas, alongamentos)
// ATENÇÃO: o nome é a chave do histórico (historico:<nome>). Nunca renomeie um
// exercício que já existe — crie outro.

export const MEDIA_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

// Grupos, na ordem em que aparecem no catálogo e nos filtros.
export const CATALOG_GROUPS = ['Peito', 'Costas', 'Ombros', 'Braços', 'Pernas', 'Glúteo', 'Core', 'Peso do corpo', 'Mobilidade'];

const e = (cat, prim, sec, img, tip, type = 'load') => ({ cat, prim, sec, img, tip, type });

export const CATALOG = {
  // ---------- Peito ----------
  'Supino Máquina': e('Peito', 'Peito', ['Ombro Anterior', 'Tríceps'], 'Leverage_Chest_Press', 'Mantenha o peito estufado e os ombros firmes para trás.'),
  'Crucifixo Reto Articulado': e('Peito', 'Peito', ['Ombro Anterior'], 'Butterfly', 'Sinta o peito alongar ao máximo sem dobrar muito os cotovelos.'),
  'Supino Reto com Barra': e('Peito', 'Peito', ['Ombro Anterior', 'Tríceps'], 'Barbell_Bench_Press_-_Medium_Grip', 'Escápulas juntas e pés firmes; desça a barra até o meio do peito.'),
  'Supino Inclinado com Barra': e('Peito', 'Peito', ['Ombro Anterior', 'Tríceps'], 'Barbell_Incline_Bench_Press_-_Medium_Grip', 'Banco a uns 30°; desça a barra na parte de cima do peito.'),
  'Supino Reto com Halteres': e('Peito', 'Peito', ['Ombro Anterior', 'Tríceps'], 'Dumbbell_Bench_Press', 'Desça os halteres ao lado do peito, cotovelos a uns 45° do tronco.'),
  'Supino Inclinado com Halteres': e('Peito', 'Peito', ['Ombro Anterior', 'Tríceps'], 'Incline_Dumbbell_Press', 'Banco a uns 30°; suba os halteres sem bater um no outro.'),
  'Supino Inclinado Máquina': e('Peito', 'Peito', ['Ombro Anterior', 'Tríceps'], 'Leverage_Incline_Chest_Press', 'Ajuste o banco para a pegada ficar na altura do peito.'),
  'Supino Declinado': e('Peito', 'Peito', ['Tríceps', 'Ombro Anterior'], 'Decline_Barbell_Bench_Press', 'Pés presos no apoio; desça a barra na parte de baixo do peito.'),
  'Crucifixo com Halteres': e('Peito', 'Peito', ['Ombro Anterior'], 'Dumbbell_Flyes', 'Cotovelos levemente dobrados e fixos; abra até sentir o peito alongar.'),
  'Crossover na Polia': e('Peito', 'Peito', ['Ombro Anterior'], 'Cable_Crossover', 'Um pé à frente, tronco levemente inclinado; junte as mãos à frente do corpo.'),
  'Mergulho nas Paralelas': e('Peito', 'Peito', ['Tríceps', 'Ombro Anterior'], 'Dips_-_Chest_Version', 'Incline o tronco à frente e desça até os ombros ficarem na altura dos cotovelos.', 'reps'),

  // ---------- Costas ----------
  'Puxada Alta Aberta Frente': e('Costas', 'Costas', ['Bíceps', 'Ombro Posterior'], 'Wide-Grip_Lat_Pulldown', 'Não mexa as escápulas durante a puxada! Puxe com os cotovelos até a frente do peito.'),
  'Remada Baixa com Triângulo': e('Costas', 'Costas', ['Bíceps', 'Ombro Posterior'], 'Seated_Cable_Rows', 'Tronco levemente inclinado, puxe no umbigo.'),
  'Puxada Fechada': e('Costas', 'Costas', ['Bíceps'], 'Close-Grip_Front_Lat_Pulldown', 'Pegada fechada; puxe até a parte de cima do peito, sem jogar o tronco para trás.'),
  'Pulldown com Braço Reto': e('Costas', 'Costas', ['Tríceps'], 'Straight-Arm_Pulldown', 'Braços quase esticados; desça a barra até a coxa usando as costas.'),
  'Barra Fixa': e('Costas', 'Costas', ['Bíceps', 'Ombro Posterior'], 'Pullups', 'Pegada aberta; suba até o queixo passar da barra, sem balançar.', 'reps'),
  'Barra Fixa Supinada': e('Costas', 'Costas', ['Bíceps'], 'Chin-Up', 'Palmas para você; suba até o queixo passar da barra.', 'reps'),
  'Remada Curvada com Barra': e('Costas', 'Costas', ['Bíceps', 'Ombro Posterior', 'Lombar'], 'Bent_Over_Barbell_Row', 'Tronco inclinado e coluna reta; puxe a barra até a barriga.'),
  'Remada Unilateral com Halter': e('Costas', 'Costas', ['Bíceps', 'Ombro Posterior'], 'One-Arm_Dumbbell_Row', 'Mão e joelho no banco; puxe o halter em direção ao quadril.'),
  'Remada Cavalinho': e('Costas', 'Costas', ['Bíceps', 'Ombro Posterior'], 'T-Bar_Row_with_Handle', 'Peito para fora, coluna reta; puxe até a barra encostar no peito.'),
  'Remada Máquina': e('Costas', 'Costas', ['Bíceps', 'Ombro Posterior'], 'Leverage_Iso_Row', 'Peito colado no apoio; puxe com os cotovelos, juntando as escápulas.'),
  'Levantamento Terra': e('Costas', 'Lombar', ['Glúteo', 'Posterior de Coxa', 'Costas', 'Trapézio'], 'Barbell_Deadlift', 'Barra rente às pernas e coluna reta; empurre o chão com os pés.'),
  'Hiperextensão Lombar': e('Costas', 'Lombar', ['Glúteo', 'Posterior de Coxa'], 'Hyperextensions_Back_Extensions', 'Suba até o corpo ficar reto, sem arquear demais.', 'reps'),
  'Encolhimento com Halteres': e('Costas', 'Trapézio', [], 'Dumbbell_Shrug', 'Suba os ombros em direção às orelhas e segure 1s, sem girar.'),

  // ---------- Ombros ----------
  'Elevação Lateral (Máquina/Polia)': e('Ombros', 'Ombro Lateral', ['Trapézio'], 'Side_Lateral_Raise', 'Empurre o peso para os lados, não para cima.'),
  'Desenvolvimento Articulado Aberto': e('Ombros', 'Ombro Anterior', ['Ombro Lateral', 'Tríceps'], 'Standing_Military_Press', 'Não estique totalmente os cotovelos no topo para manter a tensão.'),
  'Desenvolvimento com Halteres': e('Ombros', 'Ombro Anterior', ['Ombro Lateral', 'Tríceps'], 'Dumbbell_Shoulder_Press', 'Sentado com apoio nas costas; suba os halteres sem bater um no outro.'),
  'Desenvolvimento com Barra': e('Ombros', 'Ombro Anterior', ['Ombro Lateral', 'Tríceps'], 'Barbell_Shoulder_Press', 'Desça a barra até a altura do queixo, abdômen firme.'),
  'Desenvolvimento Arnold': e('Ombros', 'Ombro Anterior', ['Ombro Lateral', 'Tríceps'], 'Arnold_Dumbbell_Press', 'Comece com as palmas para você e gire enquanto sobe.'),
  'Elevação Lateral com Halteres': e('Ombros', 'Ombro Lateral', ['Trapézio'], 'Side_Lateral_Raise', 'Suba até a altura dos ombros, cotovelos levemente dobrados.'),
  'Elevação Frontal': e('Ombros', 'Ombro Anterior', ['Ombro Lateral'], 'Front_Dumbbell_Raise', 'Suba o halter à frente até a altura dos olhos, sem balançar.'),
  'Crucifixo Inverso (Máquina)': e('Ombros', 'Ombro Posterior', ['Trapézio', 'Costas'], 'Reverse_Machine_Flyes', 'Peito no apoio; abra os braços para trás juntando as escápulas.'),
  'Face Pull': e('Ombros', 'Ombro Posterior', ['Trapézio'], 'Face_Pull', 'Corda na altura do rosto; puxe abrindo as mãos para os lados das orelhas.'),
  'Remada Alta': e('Ombros', 'Ombro Lateral', ['Trapézio'], 'Upright_Barbell_Row', 'Pegada na largura dos ombros; suba a barra até o peito com os cotovelos à frente.'),

  // ---------- Braços ----------
  'Rosca Bíceps (Máquina/Polia Baixa)': e('Braços', 'Bíceps', ['Antebraço'], 'Standing_Biceps_Cable_Curl', 'Cotovelos fixos, evite balançar o tronco para ajudar o movimento.'),
  'Tríceps Pulley Barra Reta': e('Braços', 'Tríceps', [], 'Triceps_Pushdown', 'Mantenha os cotovelos colados ao tronco.'),
  'Rosca Direta com Barra': e('Braços', 'Bíceps', ['Antebraço'], 'Barbell_Curl', 'Cotovelos colados no corpo; suba sem jogar o tronco para trás.'),
  'Rosca Alternada com Halteres': e('Braços', 'Bíceps', ['Antebraço'], 'Dumbbell_Alternate_Bicep_Curl', 'Um braço de cada vez, girando a palma para cima enquanto sobe.'),
  'Rosca Martelo': e('Braços', 'Bíceps', ['Antebraço'], 'Hammer_Curls', 'Palmas uma de frente para a outra o tempo todo.'),
  'Rosca Scott': e('Braços', 'Bíceps', ['Antebraço'], 'Preacher_Curl', 'Braço apoiado no banco; desça até quase esticar, sem soltar no fim.'),
  'Rosca Concentrada': e('Braços', 'Bíceps', [], 'Concentration_Curls', 'Cotovelo apoiado na parte de dentro da coxa; suba devagar.'),
  'Rosca na Máquina': e('Braços', 'Bíceps', ['Antebraço'], 'Machine_Bicep_Curl', 'Cotovelos alinhados com o eixo da máquina.'),
  'Tríceps Corda': e('Braços', 'Tríceps', [], 'Triceps_Pushdown_-_Rope_Attachment', 'Cotovelos fixos; abra a corda para os lados no fim do movimento.'),
  'Tríceps Testa': e('Braços', 'Tríceps', [], 'EZ-Bar_Skullcrusher', 'Deitado, desça a barra em direção à testa mexendo só os cotovelos.'),
  'Tríceps Francês': e('Braços', 'Tríceps', [], 'Standing_Dumbbell_Triceps_Extension', 'Halter atrás da cabeça; estique os braços sem abrir os cotovelos.'),
  'Tríceps no Banco': e('Braços', 'Tríceps', ['Peito', 'Ombro Anterior'], 'Bench_Dips', 'Mãos no banco atrás de você; desça dobrando os cotovelos para trás.', 'reps'),
  'Rosca de Punho': e('Braços', 'Antebraço', [], 'Palms-Up_Barbell_Wrist_Curl_Over_A_Bench', 'Antebraço apoiado no banco; suba a barra só com o punho.'),

  // ---------- Pernas ----------
  'Leg Press Horizontal Articulado': e('Pernas', 'Quadríceps', ['Glúteo', 'Adutores'], 'Leg_Press', 'Máxima amplitude, não trave os joelhos no topo.'),
  'Agachamento Hack': e('Pernas', 'Quadríceps', ['Glúteo', 'Adutores'], 'Hack_Squat', 'Desça o máximo sem descolar o calcanhar da base.'),
  'Cadeira Extensora': e('Pernas', 'Quadríceps', [], 'Leg_Extensions', 'Pausa de 1s no topo com a perna esticada.'),
  'Cadeira Extensora Unilateral': e('Pernas', 'Quadríceps', [], 'Single-Leg_Leg_Extension', 'Uma perna por vez, pausa de 1s com a perna esticada. Registre as repetições de uma perna (faça as duas).'),
  'Cadeira Flexora': e('Pernas', 'Posterior de Coxa', ['Panturrilha'], 'Seated_Leg_Curl', 'Puxe apertando a perna contra o assento.'),
  'Mesa Flexora': e('Pernas', 'Posterior de Coxa', ['Panturrilha'], 'Lying_Leg_Curls', 'Quadril colado na mesa durante o movimento.'),
  'Flexora em Pé': e('Pernas', 'Posterior de Coxa', ['Panturrilha'], 'Standing_Leg_Curl', 'Uma perna por vez; quadril parado. Registre as repetições de uma perna.'),
  'Cadeira Adutora': e('Pernas', 'Adutores', [], 'Thigh_Adductor', 'Aperte bem no final do movimento.'),
  'Agachamento Livre': e('Pernas', 'Quadríceps', ['Glúteo', 'Adutores', 'Lombar'], 'Barbell_Full_Squat', 'Barra apoiada no trapézio; desça com o peito aberto até a coxa passar da paralela.'),
  'Agachamento no Smith': e('Pernas', 'Quadríceps', ['Glúteo', 'Adutores'], 'Smith_Machine_Squat', 'Pés um pouco à frente da barra; desça sem tirar o calcanhar do chão.'),
  'Agachamento Goblet': e('Pernas', 'Quadríceps', ['Glúteo'], 'Goblet_Squat', 'Halter junto ao peito, cotovelos por dentro dos joelhos; desça com o tronco em pé.'),
  'Agachamento Búlgaro': e('Pernas', 'Quadríceps', ['Glúteo', 'Adutores'], 'Split_Squat_with_Dumbbells', 'Pé de trás no banco; desça reto. Registre as repetições de uma perna (faça as duas).'),
  'Afundo com Halteres': e('Pernas', 'Quadríceps', ['Glúteo'], 'Dumbbell_Lunges', 'Passo largo, tronco em pé; o joelho de trás quase encosta no chão.'),
  'Subida no Banco': e('Pernas', 'Quadríceps', ['Glúteo'], 'Dumbbell_Step_Ups', 'Halteres nas mãos, pé inteiro no banco; suba empurrando pelo calcanhar da perna de cima, sem impulso da de baixo. Registre as repetições de uma perna (faça as duas).'),
  'Stiff com Halteres': e('Pernas', 'Posterior de Coxa', ['Glúteo', 'Lombar'], 'Stiff-Legged_Dumbbell_Deadlift', 'Joelhos quase esticados, desça os halteres rente às pernas jogando o quadril para trás, coluna reta.'),
  'Stiff com Barra': e('Pernas', 'Posterior de Coxa', ['Glúteo', 'Lombar'], 'Stiff-Legged_Barbell_Deadlift', 'Joelhos quase esticados; desça a barra rente às pernas, coluna reta.'),
  'Levantamento Terra Romeno': e('Pernas', 'Posterior de Coxa', ['Glúteo', 'Lombar'], 'Romanian_Deadlift', 'Joelhos levemente dobrados; jogue o quadril para trás até sentir o posterior.'),
  'Panturrilha Sentado': e('Pernas', 'Panturrilha', [], 'Seated_Calf_Raise', 'Alongue tudo embaixo e pause 1s no topo.'),
  'Panturrilha em Pé': e('Pernas', 'Panturrilha', [], 'Standing_Calf_Raises', 'Desça o calcanhar o máximo e suba na ponta dos pés.'),
  'Panturrilha no Leg Press': e('Pernas', 'Panturrilha', [], 'Calf_Press_On_The_Leg_Press_Machine', 'Só a ponta dos pés na plataforma; empurre com os tornozelos.'),

  // ---------- Glúteo ----------
  'Cadeira Abdutora': e('Glúteo', 'Glúteo Médio', ['Glúteo Máximo', 'Lateral do Quadril'], 'Thigh_Abductor', 'Incline o tronco levemente à frente para focar no glúteo máximo.'),
  'Elevação Pélvica': e('Glúteo', 'Glúteo', ['Posterior de Coxa'], 'Barbell_Hip_Thrust', 'Costas apoiadas no banco, barra (com proteção) no quadril; suba até o tronco ficar reto e aperte o glúteo 1s no topo.'),
  'Glúteo na Polia (Coice)': e('Glúteo', 'Glúteo', ['Posterior de Coxa'], 'Glute_Kickback', 'Tornozeleira na polia baixa; leve a perna para trás sem arquear a lombar.'),
  'Ponte de Glúteo': e('Glúteo', 'Glúteo', ['Posterior de Coxa'], 'Barbell_Glute_Bridge', 'Deitado no chão, pés perto do quadril; suba apertando o glúteo.'),

  // ---------- Core ----------
  'Abdominal Máquina': e('Core', 'Abdômen', [], 'Ab_Crunch_Machine', 'Enrole o tronco, não dobre apenas o quadril.'),
  'Abdominal na Polia': e('Core', 'Abdômen', [], 'Cable_Crunch', 'De joelhos, corda atrás da cabeça; enrole o tronco em direção ao chão.'),
  'Abdominal Supra': e('Core', 'Abdômen', [], 'Crunches', 'Tire só as escápulas do chão; não puxe o pescoço.', 'reps'),
  'Abdominal Bicicleta': e('Core', 'Abdômen', ['Oblíquos'], 'Air_Bike', 'Leve o cotovelo em direção ao joelho oposto, alternando. Conte os dois lados.', 'reps'),
  'Elevação de Pernas na Barra': e('Core', 'Abdômen', ['Oblíquos'], 'Hanging_Leg_Raise', 'Pendurado, suba as pernas sem balançar o corpo.', 'reps'),
  'Russian Twist': e('Core', 'Oblíquos', ['Abdômen'], 'Russian_Twist', 'Tronco inclinado para trás; gire de um lado para o outro. Conte os dois lados.', 'reps'),
  'Roda Abdominal': e('Core', 'Abdômen', ['Lombar'], 'Ab_Roller', 'De joelhos; vá à frente só até onde conseguir manter a lombar reta.', 'reps'),
  'Prancha Frontal': e('Core', 'Abdômen', ['Oblíquos', 'Lombar'], 'Plank', 'Cotovelos embaixo dos ombros, corpo em linha reta; não deixe o quadril cair.', 'time'),
  'Prancha Lateral': e('Core', 'Oblíquos', ['Abdômen'], 'Side_Bridge', 'Apoio no cotovelo e na lateral do pé, quadril alto. Registre o tempo de um lado (faça os dois).', 'time')
};

// Músculo principal -> grupo do catálogo (exercícios criados pelo usuário).
export const MUSCLE_CATEGORIES = {
  'Peito': 'Peito',
  'Costas': 'Costas',
  'Lombar': 'Costas',
  'Trapézio': 'Costas',
  'Ombro Anterior': 'Ombros',
  'Ombro Lateral': 'Ombros',
  'Ombro Posterior': 'Ombros',
  'Bíceps': 'Braços',
  'Tríceps': 'Braços',
  'Antebraço': 'Braços',
  'Quadríceps': 'Pernas',
  'Posterior de Coxa': 'Pernas',
  'Adutores': 'Pernas',
  'Panturrilha': 'Pernas',
  'Glúteo': 'Glúteo',
  'Glúteo Médio': 'Glúteo',
  'Abdômen': 'Core',
  'Oblíquos': 'Core'
};

// Músculos mais específicos que o mapa mostra separados, mas que no volume
// semanal somam no grupo principal.
export const VOLUME_GROUP = {
  'Glúteo Médio': 'Glúteo',
  'Glúteo Máximo': 'Glúteo',
  'Reto Femoral': 'Quadríceps',
  'Oblíquos': 'Abdômen'
};

export const EXERCISE_TYPES = {
  load: 'Carga e repetições',
  reps: 'Só repetições',
  time: 'Tempo (segundos)'
};
