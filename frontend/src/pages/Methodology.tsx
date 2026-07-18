import { SubTabs, Equation, Cite, Refs, type SubTabDef } from '@fasl-work/caos-app-shell';
import { useT } from '../lib/i18n';

export default function Methodology() {
  const t = useT();

  const tabs: SubTabDef[] = [
    {
      id: 'transforms',
      label: t('Transforms', 'Transformadas'),
      content: (
        <div className="il-doc" style={{ margin: 0 }}>
          <h3>{t('Orthonormal transform bases', 'Bases de transformada ortonormal')}</h3>
          <p>
            {t(
              'The image is projected onto a fixed orthonormal basis. The coefficient of each basis function is an inner product, and the reconstruction is their weighted sum. Keeping only the largest coefficients (nonlinear approximation) or quantizing them is exactly transform compression.',
              'La imagen se proyecta sobre una base ortonormal fija. El coeficiente de cada funcion base es un producto interno, y la reconstrucción es su suma ponderada. Quedarse solo con los mayores coeficientes (aproximación no lineal) o cuantizarlos es exactamente la compresion por transformada.',
            )}
          </p>
          <Equation tex={String.raw`c_k=\langle f,\varphi_k\rangle,\qquad \hat f=\sum_{k\in S} c_k\,\varphi_k`} />
          <p>
            {t(
              'The basis sets the character of an edit: Fourier and cosine bases are global (a coefficient is a frequency across the whole image), wavelets are localized in space and scale, and the Karhunen-Loeve basis is data-adaptive. In every case editing a coefficient is a stable, bounded change, but never a semantic one.',
              'La base fija el caracter de una edicion: las bases de Fourier y coseno son globales (un coeficiente es una frecuencia en toda la imagen), las wavelets estan localizadas en espacio y escala, y la base de Karhunen-Loeve es adaptada a los datos. En todo caso editar un coeficiente es un cambio estable y acotado, pero nunca semantico.',
            )}
          </p>
          <Refs label={t('References', 'Referencias')} ids={['cooley1965fft', 'ahmed1974dct', 'wallace1991jpeg', 'mallat1989mra', 'daubechies1988', 'oppenheim1981phase']} />
        </div>
      ),
    },
    {
      id: 'frames',
      label: t('Frames and dictionaries', 'Marcos y diccionarios'),
      content: (
        <div className="il-doc" style={{ margin: 0 }}>
          <h3>{t('Overcomplete frames and sparse dictionaries', 'Marcos sobrecompletos y diccionarios dispersos')}</h3>
          <p>
            {t(
              'An overcomplete dictionary has more atoms than dimensions, so an image can be written as a sparse combination: few atoms, each meaningful. The dictionary can be fixed (curvelets, shearlets) or learned from image patches. The image is the pair (dictionary, sparse code).',
              'Un diccionario sobrecompleto tiene mas atomos que dimensiones, así que una imagen puede escribirse como combinacion dispersa: pocos atomos, cada uno con sentido. El diccionario puede ser fijo (curvelets, shearlets) o aprendido de parches de imagen. La imagen es el par (diccionario, código disperso).',
            )}
          </p>
          <Equation tex={String.raw`\min_{a}\;\|f - D\,a\|_2^2 \quad \text{s.t.}\quad \|a\|_0 \le T`} />
          <p>
            {t('Editing an atom amplitude is a local, oriented, meaningful change; swapping the dictionary re-expresses the same image in a different alphabet. Learned by K-SVD or online dictionary learning ',
              'Editar la amplitud de un atomo es un cambio local, orientado y con sentido; cambiar el diccionario re-expresa la misma imagen en otro alfabeto. Aprendido por K-SVD o aprendizaje de diccionario en linea ')}
            (<Cite id="aharon2006ksvd" />, <Cite id="olshausen1996" />).
          </p>
          <Refs label={t('References', 'Referencias')} ids={['olshausen1996', 'aharon2006ksvd', 'tang2007haar', 'donoho2006cs']} />
        </div>
      ),
    },
    {
      id: 'neural',
      label: t('Neural fields', 'Campos neuronales'),
      content: (
        <div className="il-doc" style={{ margin: 0 }}>
          <h3>{t('Implicit neural representations', 'Representaciones neuronales implicitas')}</h3>
          <p>
            {t('A small multilayer perceptron is overfit to one image, mapping a coordinate to a colour. With a Fourier feature encoding or periodic activations it captures high frequencies; the stored object is the weight vector, a learned descendant of closed-form pixel art ',
              'Un pequeño perceptron multicapa se sobreajusta a una imagen, mapeando una coordenada a un color. Con una codificacion de rasgos de Fourier o activaciones periodicas captura altas frecuencias; el objeto almacenado es el vector de pesos, un descendiente aprendido del arte de fórmula por pixel ')}
            (<Cite id="tancik2020fourier" />, <Cite id="sitzmann2020siren" />).
          </p>
          <Equation tex={String.raw`f_\theta(x,y)=W_L\,\sigma(\cdots\sigma(W_1\,\gamma(x,y)))\to(R,G,B)`} />
          <p>
            {t('Perturbing a raw weight yields noise (the weight space is a compression code, not an edit space); a modulation latent, or a frequency knob, gives meaningful control. Storing the quantized weights is a form of compression ',
              'Perturbar un peso crudo da ruido (el espacio de pesos es un código de compresion, no un espacio de edicion); un latente de modulacion, o una perilla de frecuencia, da control con sentido. Almacenar los pesos cuantizados es una forma de compresion ')}
            (<Cite id="dupont2021coin" />).
          </p>
          <Refs label={t('References', 'Referencias')} ids={['tancik2020fourier', 'sitzmann2020siren', 'dupont2021coin']} />
        </div>
      ),
    },
    {
      id: 'symbolic',
      label: t('Symbolic', 'Simbolico'),
      content: (
        <div className="il-doc" style={{ margin: 0 }}>
          <h3>{t('Symbolic formula art and compositional networks', 'Arte de formula simbolica y redes composicionales')}</h3>
          <p>
            {t(
              'A compositional pattern producing network, or a symbolic expression found by regression, maps a coordinate to a colour through interpretable primitives (sine, Gaussian, absolute value). The one genuinely exact case of image-to-equation is the Fourier descriptor of a closed contour.',
              'Una red productora de patrones composicionales, o una expresion simbolica hallada por regresion, mapea una coordenada a un color a traves de primitivas interpretables (seno, gaussiana, valor absoluto). El unico caso genuinamente exacto de imagen-a-ecuacion es el descriptor de Fourier de un contorno cerrado.',
            )}
          </p>
          <Equation tex={String.raw`c_k=\frac{1}{N}\sum_{n=0}^{N-1} z_n\,e^{-i\,2\pi k n/N}\qquad(\text{epicycles of a contour } z_n)`} />
          <p>
            {t('Compact, factored expressions perturb meaningfully; complex high-fidelity fits are readable but brittle ',
              'Las expresiones compactas y factorizadas se perturban con sentido; los ajustes complejos de alta fidelidad son legibles pero fragiles ')}
            (<Cite id="stanley2007cppn" />, <Cite id="cranmer2023pysr" />).
          </p>
          <Refs label={t('References', 'Referencias')} ids={['stanley2007cppn', 'cranmer2023pysr', 'yeganeh2024']} />
        </div>
      ),
    },
    {
      id: 'generative',
      label: t('Generative', 'Generativo'),
      content: (
        <div className="il-doc" style={{ margin: 0 }}>
          <h3>{t('Generative latents and diffusion', 'Latentes generativos y difusion')}</h3>
          <p>
            {t('A variational or adversarial model gives the image a low-dimensional latent code whose disentangled directions correspond to human-meaningful attributes: this is the most editable representation. A diffusion model turns a sketch, stroke or text description into a plausible image ',
              'Un modelo variacional o adversarial da a la imagen un código latente de baja dimension cuyas direcciones desenredadas corresponden a atributos con sentido humano: es la representacion mas editable. Un modelo de difusion convierte un boceto, trazo o descripcion de texto en una imagen plausible ')}
            (<Cite id="karras2019stylegan" />, <Cite id="harkonen2020ganspace" />, <Cite id="rombach2022ldm" />).
          </p>
          <Equation tex={String.raw`x = \mathcal{D}(z),\qquad z' = z + \alpha\,\mathbf{d}\;\;(\text{a semantic direction})`} />
          <p>
            {t('Moving along a direction is a smooth, semantic edit; a prompt or noise change gives a plausible but globally different image (semantic but entangled), not a faithful local edit.',
              'Moverse a lo largo de una dirección es una edicion suave y semantica; un cambio de prompt o de ruido da una imagen plausible pero globalmente distinta (semantica pero enredada), no una edicion local fiel.')}
          </p>
          <Refs label={t('References', 'Referencias')} ids={['kingma2013vae', 'karras2019stylegan', 'harkonen2020ganspace', 'ho2020ddpm', 'rombach2022ldm', 'cheng2023diss']} />
        </div>
      ),
    },
  ];

  return (
    <div className="il-doc">
      <p className="il-kicker">{t('Methodology', 'Metodologia')}</p>
      <h1>{t('How each representation is defined', 'Como se define cada representacion')}</h1>
      <p className="il-lead">
        {t(
          'Each representation family, its core mathematics, the parameters it exposes, and how those parameters behave under a nudge. The tabs below track the App workbench families; the exact per-tab definitions and their live controls are filled in as each tab lands.',
          'Cada familia de representacion, su matemática central, los parámetros que expone, y como se comportan esos parámetros ante un empujon. Las pestanas de abajo siguen las familias del banco de la App; las definiciones exactas por pestana y sus controles en vivo se completan a medida que cada pestana aterriza.',
        )}
      </p>
      <SubTabs tabs={tabs} ariaLabel={t('Representation families', 'Familias de representacion')} />
    </div>
  );
}
