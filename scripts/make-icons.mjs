/**
 * Genera los iconos de la PWA.
 *
 * El logo de marca (brand/logo.png) es un wordmark de 1162×215: a 5.4:1 no
 * sirve como icono de aplicación. Esta marca cuadrada es una T construida con
 * una barra y discos — se lee como "T" de Trainway y como barra de gimnasio,
 * y sigue siendo reconocible a 48 px en una pantalla de inicio.
 */
import { writeFileSync, mkdirSync } from 'node:fs'

const VOLT = '#FFC603'
const INK = '#0B0B0C'

/** @param {number} pad Margen de seguridad en fracción del lienzo (0.2 para maskable). */
function svg(pad) {
  const S = 512
  const inner = S * (1 - pad * 2)
  const o = S * pad

  // Proporciones de la barra dentro del área segura.
  const barH = inner * 0.155
  const barY = o + inner * 0.2
  const stemW = inner * 0.185
  const stemX = o + (inner - stemW) / 2
  const stemBottom = o + inner * 0.86

  const plateW = inner * 0.085
  const plateH = barH * 1.85
  const plateY = barY - (plateH - barH) / 2
  const r = inner * 0.03

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <rect width="${S}" height="${S}" fill="${INK}"/>
  <g fill="${VOLT}">
    <rect x="${o}" y="${barY}" width="${inner}" height="${barH}" rx="${r}"/>
    <rect x="${stemX}" y="${barY}" width="${stemW}" height="${stemBottom - barY}" rx="${r}"/>
    <rect x="${o - plateW * 0.35}" y="${plateY}" width="${plateW}" height="${plateH}" rx="${r}"/>
    <rect x="${o + inner - plateW * 0.65}" y="${plateY}" width="${plateW}" height="${plateH}" rx="${r}"/>
  </g>
</svg>`
}

mkdirSync('brand', { recursive: true })
mkdirSync('public/icons', { recursive: true })

writeFileSync('brand/icon.svg', svg(0.14))
writeFileSync('public/icons/icon.svg', svg(0.14))
writeFileSync('public/icons/icon-maskable.svg', svg(0.22))

console.log('OK: brand/icon.svg, public/icons/icon.svg, public/icons/icon-maskable.svg')
