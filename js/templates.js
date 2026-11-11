// Modelos prontos para começar (tela inicial e "Novo treino"). Depois de criados
// são treinos normais: dá para renomear, trocar exercícios, mudar séries.
import { MODE_SKILLS } from './calisthenics-data.js';

const mobility = MODE_SKILLS.mobi.map(skill => ({
  name: skill.name,
  exercises: skill.steps.map(step => step.name),
  sets: Object.fromEntries(skill.steps.map(step => [step.name, step.goal.sets]))
}));

export const TEMPLATES = [
  {
    id: 'superior-inferior',
    name: 'Superior e Inferior',
    desc: '2 treinos de academia · 4x por semana',
    workouts: [
      { name: 'Superior', exercises: ['Supino Máquina', 'Crucifixo Reto Articulado', 'Puxada Alta Aberta Frente', 'Remada Baixa com Triângulo', 'Elevação Lateral (Máquina/Polia)', 'Desenvolvimento Articulado Aberto', 'Rosca Bíceps (Máquina/Polia Baixa)', 'Tríceps Pulley Barra Reta', 'Abdominal Máquina'] },
      { name: 'Inferior', exercises: ['Leg Press Horizontal Articulado', 'Cadeira Extensora', 'Cadeira Flexora', 'Cadeira Extensora Unilateral', 'Mesa Flexora', 'Cadeira Abdutora', 'Cadeira Adutora', 'Panturrilha Sentado'] }
    ]
  },
  {
    id: 'abc',
    name: 'ABC',
    desc: 'Peito e tríceps · Costas e bíceps · Pernas e ombros',
    workouts: [
      { name: 'A · Peito e Tríceps', exercises: ['Supino Reto com Halteres', 'Supino Inclinado Máquina', 'Crucifixo Reto Articulado', 'Crossover na Polia', 'Tríceps Pulley Barra Reta', 'Tríceps Corda', 'Tríceps Francês'] },
      { name: 'B · Costas e Bíceps', exercises: ['Puxada Alta Aberta Frente', 'Remada Baixa com Triângulo', 'Remada Unilateral com Halter', 'Pulldown com Braço Reto', 'Rosca Direta com Barra', 'Rosca Martelo', 'Abdominal Máquina'] },
      { name: 'C · Pernas e Ombros', exercises: ['Leg Press Horizontal Articulado', 'Cadeira Extensora', 'Mesa Flexora', 'Cadeira Abdutora', 'Panturrilha em Pé', 'Desenvolvimento com Halteres', 'Elevação Lateral com Halteres'] }
    ]
  },
  {
    id: 'corpo-inteiro',
    name: 'Corpo inteiro',
    desc: '1 treino de academia · 2 a 3x por semana',
    workouts: [
      { name: 'Corpo Inteiro', exercises: ['Supino Máquina', 'Puxada Alta Aberta Frente', 'Leg Press Horizontal Articulado', 'Mesa Flexora', 'Desenvolvimento com Halteres', 'Remada Baixa com Triângulo', 'Prancha Frontal'] }
    ]
  },
  {
    id: 'em-casa',
    name: 'Em casa',
    desc: 'Peso do corpo, sem equipamento',
    workouts: [
      { name: 'Em Casa', exercises: ['Flexão Padrão', 'Tríceps no Banco', 'Ponte de Glúteo', 'Abdominal Supra', 'Prancha', 'Elevação de Pernas Deitado', 'Barquinho'] }
    ]
  },
  {
    id: 'mobilidade',
    name: 'Mobilidade',
    desc: '2 treinos de uns 10 minutos',
    workouts: mobility
  }
];
