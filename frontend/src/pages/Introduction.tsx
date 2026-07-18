import { Callout, Equation, InlineMath, Cite, ReferenceList } from '@fasl-work/caos-app-shell';
import { useT } from '../lib/i18n';
import { FAMILIES } from '../lib/spectrum';

export default function Introduction() {
  const t = useT();
  return (
    <div className="il-doc">
      <p className="il-kicker">{t('Introduction', 'Introducción')}</p>
      <h1>{t('One image, many mathematics', 'Una imagen, muchas matemáticas')}</h1>

      <p className="il-lead">
        {t(
          'A digital image is always a matrix of numbers. But that same image can be written in many different mathematical languages, and each one exposes a different set of parameters you can turn. ImageLab shows the same picture under each language, side by side, and lets you edit those parameters to answer one question: when does the image stay meaningful, and when does it fall apart into noise?',
          'Una imagen digital siempre es una matriz de números. Pero esa misma imagen puede escribirse en muchos lenguajes matemáticos distintos, y cada uno expone un conjunto diferente de parámetros que puedes mover. ImageLab muestra la misma imagen bajo cada lenguaje, lado a lado, y te deja editar esos parámetros para responder una pregunta: cuándo la imagen sigue teniendo sentido y cuándo se deshace en ruido.',
        )}
      </p>

      <h2>{t('The common form', 'La forma común')}</h2>
      <p>
        {t(
          'Most classical representations share one shape: the image f is a weighted sum of building blocks (a basis or a dictionary), where the weights are the coefficients you can edit.',
          'La mayoría de las representaciones clásicas comparten una forma: la imagen f es una suma ponderada de bloques constructores (una base o un diccionario), donde los pesos son los coeficientes que puedes editar.',
        )}
      </p>
      <Equation
        tex={String.raw`f(\mathbf{x}) \;=\; \sum_{k} c_k\, \varphi_k(\mathbf{x})`}
        caption={t(
          'The image as a weighted sum of building blocks phi_k with coefficients c_k. Editing one coefficient changes the image by exactly c_k times its block.',
          'La imagen como suma ponderada de bloques phi_k con coeficientes c_k. Editar un coeficiente cambia la imagen exactamente en c_k por su bloque.',
        )}
      />
      <p>
        {t('For an orthonormal transform (Fourier, cosine, wavelet) the coefficients are simply the inner products ',
          'Para una transformada ortonormal (Fourier, coseno, wavelet) los coeficientes son simplemente los productos internos ')}
        <InlineMath tex={String.raw`c_k = \langle f, \varphi_k\rangle`} />
        {t(', and keeping only the largest of them is exactly what image compression does ',
          ', y quedarse solo con los mayores es exactamente lo que hace la compresión de imágenes ')}
        (<Cite id="ahmed1974dct" />, <Cite id="wallace1991jpeg" />, <Cite id="mallat1989mra" />).
        {t(' Other families break this linear form: an implicit neural field replaces the sum with a trained network ',
          ' Otras familias rompen esta forma lineal: un campo neuronal implícito reemplaza la suma por una red entrenada ')}
        <InlineMath tex={String.raw`f_\theta(x,y)\to\text{RGB}`} />
        {t(' (', ' (')}<Cite id="sitzmann2020siren" />
        {t('), and a generative model replaces it with a decoder of a latent code.',
          '), y un modelo generativo la reemplaza por un decodificador de un código latente.')}
      </p>

      <h2>{t('The spectrum of representations', 'El espectro de representaciones')}</h2>
      <p>
        {t(
          'Order the languages by abstraction, from the raw pixel grid up to a generative latent. Each is a tab in the App, running the same selected image.',
          'Ordena los lenguajes por abstracción, desde la grilla de pixeles cruda hasta un latente generativo. Cada uno es una pestaña en la App, corriendo la misma imagen seleccionada.',
        )}
      </p>
      <div className="il-spectrum">
        {FAMILIES.map((fam) => (
          <div key={fam.id} className="il-sp-cell" style={{ ['--tone' as string]: fam.tone }}>
            <div className="n">{String(fam.index).padStart(2, '0')}</div>
            <div className="t">{t(fam.en, fam.es)}</div>
            <div className="d">{t(fam.blurb_en, fam.blurb_es)}</div>
            <div style={{ marginTop: '0.35rem' }}>
              <span className={`il-badge edit-${fam.edit}`}>{t(fam.editLabel_en, fam.editLabel_es)}</span>
            </div>
          </div>
        ))}
      </div>

      <h2>{t('The central question: editability', 'La pregunta central: editabilidad')}</h2>
      <p>
        {t(
          'A simple scene is trivially editable: a red-bordered circle on a green background, occluded by a triangle, is a few numbers, and changing them gives sensible variations. A closed-form formula that reproduces a photograph, by contrast, is so intricate that any change shatters it. Between these extremes lies a whole spectrum, and the surprising result is that editability does not fall off smoothly along it.',
          'Una escena simple es trivialmente editable: un circulo de borde rojo sobre fondo verde, ocluido por un triangulo, son unos pocos números, y cambiarlos da variaciones con sentido. Una formula en forma cerrada que reproduce una fotografia, en cambio, es tan intrincada que cualquier cambio la destroza. Entre estos extremos hay todo un espectro, y el resultado sorprendente es que la editabilidad no decae suavemente a lo largo de el.',
        )}
      </p>
      <Callout variant="strong" title={t('Editability is U-shaped, not monotone', 'La editabilidad tiene forma de U, no es monotona')}>
        {t(
          'It is high at two poles: the designed-structure pole (geometric primitives, sparse-dictionary atoms, where humans built local meaningful coordinates) and the learned-manifold pole (disentangled directions in a generative latent). It collapses toward noise in between: perturb a raw neural-field weight, or a constant of a brittle fitted formula, and the image dissolves. A parameter is both stable and meaningful only when it indexes a low-dimensional manifold of plausible images with locally disentangled coordinates.',
          'Es alta en dos polos: el polo de estructura disenada (primitivas geometricas, atomos de diccionario disperso, donde los humanos construyeron coordenadas locales con sentido) y el polo de variedad aprendida (direcciones desenredadas en un latente generativo). Colapsa hacia el ruido en el medio: perturba un peso crudo de un campo neuronal, o una constante de una formula ajustada fragil, y la imagen se disuelve. Un parámetro es estable Y significativo solo cuando indexa una variedad de baja dimension de imagenes plausibles con coordenadas localmente desenredadas.',
        )}
      </Callout>
      <p>
        {t(
          'This is not folklore: evolved compositional representations stay factored and editable while gradient-fit networks that draw the same image become entangled ',
          'Esto no es folclore: las representaciones composicionales evolucionadas permanecen factorizadas y editables mientras que las redes ajustadas por gradiente que dibujan la misma imagen se enredan ',
        )}
        (<Cite id="fer2025" />).
      </p>

      <h3>{t('The four responses to a nudge', 'Las cuatro respuestas a un empujon')}</h3>
      <table className="il-table">
        <thead>
          <tr>
            <th>{t('Response', 'Respuesta')}</th>
            <th>{t('Where', 'Donde')}</th>
            <th>{t('Perturb a parameter and ...', 'Perturba un parámetro y ...')}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><span className="il-badge edit-global">{t('global-stable', 'global-estable')}</span></td>
            <td>{t('Fourier, cosine, wavelet coefficients', 'coeficientes de Fourier, coseno, wavelet')}</td>
            <td>{t('a smooth global change; stable, but not semantic', 'un cambio global suave; estable, pero no semantico')}</td>
          </tr>
          <tr>
            <td><span className="il-badge edit-semantic">{t('semantic-local', 'semantico-local')}</span></td>
            <td>{t('primitives, sparse atoms', 'primitivas, atomos dispersos')}</td>
            <td>{t('a meaningful, controllable, local edit', 'una edicion local, significativa y controlable')}</td>
          </tr>
          <tr>
            <td><span className="il-badge edit-learned">{t('semantic-entangled', 'semantico-enredado')}</span></td>
            <td>{t('generative latents, diffusion', 'latentes generativos, difusion')}</td>
            <td>{t('a plausible but globally different image', 'una imagen plausible pero globalmente distinta')}</td>
          </tr>
          <tr>
            <td><span className="il-badge edit-noise">{t('unstable-noise', 'inestable-ruido')}</span></td>
            <td>{t('raw network weights, brittle formula constants', 'pesos crudos de red, constantes de formula fragiles')}</td>
            <td>{t('garbage; the parameter has no local meaning', 'basura; el parámetro no tiene sentido local')}</td>
          </tr>
        </tbody>
      </table>

      <h2>{t('What this lab is, and is not', 'Que es este laboratorio, y que no es')}</h2>
      <Callout variant="honest" title={t('Honest scope', 'Alcance honesto')}>
        {t(
          'It IS an interactive, referenced tour of image representations, with light transforms computed live in your browser and heavier representations baked offline by an open, reproducible pipeline. It is NOT a claim that arbitrary photographs reduce to compact, faithful, human-readable equations (they do not; the app shows the genuine partial results and says so). Diffusion reconstructions are labelled as generative, not faithful. The explicit-formula genre is cited and linked; every formula shown here is our own, and no third party artwork is redistributed.',
          'ES un recorrido interactivo y referenciado por las representaciones de imagenes, con transformadas ligeras calculadas en vivo en tu navegador y representaciones mas pesadas precalculadas offline por un pipeline abierto y reproducible. NO es una afirmacion de que fotografias arbitrarias se reduzcan a ecuaciones compactas, fieles y legibles por humanos (no lo hacen; la app muestra los resultados parciales genuinos y lo dice). Las reconstrucciones por difusion se etiquetan como generativas, no fieles. El genero del arte de formula se cita y enlaza; toda formula mostrada aquí es propia, y no se redistribuye obra de terceros.',
        )}
      </Callout>

      <ReferenceList
        heading={t('References', 'Referencias')}
        ids={[
          'fer2025',
          'ahmed1974dct',
          'wallace1991jpeg',
          'mallat1989mra',
          'sitzmann2020siren',
          'yeganeh2024',
        ]}
      />
    </div>
  );
}
