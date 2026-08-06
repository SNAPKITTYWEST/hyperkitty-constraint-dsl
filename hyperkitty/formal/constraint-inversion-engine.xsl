<?xml version="1.0" encoding="UTF-8"?>

<xsl:stylesheet
    version="3.0"
    xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
    xmlns:xs="http://www.w3.org/2001/XMLSchema"
    xmlns:map="http://www.w3.org/2005/xpath-functions/map"
    xmlns:array="http://www.w3.org/2005/xpath-functions/array"
    xmlns:fc="urn:snapkitty:formal-constraint:1"
    xmlns:inv="urn:snapkitty:invariant:1"
    xmlns:hol="urn:snapkitty:hol:1"
    xmlns:lean="urn:snapkitty:lean:1"
    xmlns:agda="urn:snapkitty:agda:1"
    xmlns:proof="urn:snapkitty:proof:1"
    xmlns:err="urn:snapkitty:error:1"
    exclude-result-prefixes="xs map array fc inv hol lean agda proof err">

  <!-- ============================================================
       ANXLST FORMAL CONSTRAINT INVERSION ENGINE v1.0.0

       PURPOSE: Transform constraint-first specs into typed, rejection-first,
       proof-carrying XML with obligations across HOL/Lean/Agda.

       FORMALIZATION PATH:
       source XML → classification → inversion → normalization →
       HOL/Lean/Agda obligations → 20x Agda iterations →
       correspondence checks → proof receipts
       ============================================================ -->

  <xsl:output method="xml" encoding="UTF-8" indent="yes"/>
  <xsl:strip-space elements="*"/>

  <xsl:mode name="fc:classify" on-no-match="shallow-skip"/>
  <xsl:mode name="fc:invert" on-no-match="shallow-skip"/>
  <xsl:mode name="fc:normalize" on-no-match="shallow-skip"/>
  <xsl:mode name="fc:emit-hol" on-no-match="shallow-skip"/>
  <xsl:mode name="fc:emit-lean" on-no-match="shallow-skip"/>
  <xsl:mode name="fc:emit-agda" on-no-match="shallow-skip"/>
  <xsl:mode name="fc:emit-iterations" on-no-match="shallow-skip"/>

  <!-- GLOBAL PARAMETERS -->
  <xsl:param name="project-name" as="xs:string" select="'FormalConstraintMachine'"/>
  <xsl:param name="organization" as="xs:string" select="'SNAPKITTYWEST'"/>
  <xsl:param name="formalization-order" as="xs:string" select="'HOL_TO_LEAN_TO_AGDA'"/>
  <xsl:param name="agda-iteration-multiplicity" as="xs:integer" select="20"/>
  <xsl:param name="strict-mode" as="xs:boolean" select="true()"/>
  <xsl:param name="allow-unresolved-output" as="xs:boolean" select="true()"/>
  <xsl:param name="emit-source-programs" as="xs:boolean" select="true()"/>
  <xsl:param name="emit-proof-receipts" as="xs:boolean" select="true()"/>
  <xsl:param name="stylesheet-version" as="xs:string" select="'1.0.0'"/>
  <xsl:param name="execution-policy" as="xs:string" select="'PARSE_INVERT_FORMALIZE_VERIFY_REPEAT'"/>

  <!-- KEYS -->
  <xsl:key name="constraint-by-id" match="*[@id]" use="@id"/>
  <xsl:key name="domain-by-id" match="Domains/*[@id]" use="@id"/>
  <xsl:key name="phase-by-index" match="Pipeline/*[@index]" use="@index"/>

  <!-- UTILITY FUNCTIONS (slug, symbol, node-path, stable-id, classification, polarity, normalization, inversion, type-generation, iteration-transforms) -->

  <xsl:function name="fc:slug" as="xs:string">
    <xsl:param name="value" as="xs:string?"/>
    <xsl:variable name="lower" select="lower-case(normalize-space(string($value)))"/>
    <xsl:variable name="collapsed" select="replace($lower, '[^a-z0-9]+', '-')"/>
    <xsl:sequence select="replace(replace($collapsed, '^-+', ''), '-+$', '')"/>
  </xsl:function>

  <xsl:function name="fc:symbol" as="xs:string">
    <xsl:param name="value" as="xs:string?"/>
    <xsl:variable name="clean" select="replace(normalize-space(string($value)), '[^A-Za-z0-9_]', '_')"/>
    <xsl:sequence select="if (matches($clean, '^[0-9]')) then concat('_', $clean) else if ($clean = '') then 'unnamed' else $clean"/>
  </xsl:function>

  <xsl:function name="fc:boolean-text" as="xs:string">
    <xsl:param name="value" as="xs:boolean"/>
    <xsl:sequence select="if ($value) then 'true' else 'false'"/>
  </xsl:function>

  <xsl:function name="fc:node-path" as="xs:string">
    <xsl:param name="node" as="node()"/>
    <xsl:sequence select="string-join($node/ancestor-or-self::* ! concat('/', name(), '[', count(preceding-sibling::*[name() = name(current())]) + 1, ']'), '')"/>
  </xsl:function>

  <xsl:function name="fc:stable-id" as="xs:string">
    <xsl:param name="node" as="node()"/>
    <xsl:param name="prefix" as="xs:string"/>
    <xsl:variable name="declared" select="$node/@id/string()"/>
    <xsl:sequence select="if (normalize-space($declared) ne '') then concat($prefix, '-', fc:slug($declared)) else concat($prefix, '-', fc:slug(name($node)), '-', format-integer(count($node/preceding::*) + 1, '000000'))"/>
  </xsl:function>

  <xsl:function name="fc:source-class" as="xs:string">
    <xsl:param name="node" as="element()"/>
    <xsl:choose>
      <xsl:when test="$node/@source-class"><xsl:sequence select="upper-case(string($node/@source-class))"/></xsl:when>
      <xsl:when test="local-name($node) = ('BooleanKernel', 'RefinementTypes', 'TruthLayer', 'TechnologyRules', 'Structure', 'ComponentModel', 'DAG', 'Transformation', 'Pipeline', 'Objective')"><xsl:sequence select="'SPECIFIED'"/></xsl:when>
      <xsl:when test="contains(lower-case(string($node)), 'verified') and $node/@compiled = 'true'"><xsl:sequence select="'FORMAL'"/></xsl:when>
      <xsl:when test="contains(lower-case(string($node)), 'invalid') or contains(lower-case(string($node)), 'forbidden')"><xsl:sequence select="'SPECIFIED'"/></xsl:when>
      <xsl:otherwise><xsl:sequence select="'UNRESOLVED'"/></xsl:otherwise>
    </xsl:choose>
  </xsl:function>

  <xsl:function name="fc:constraint-kind" as="xs:string">
    <xsl:param name="node" as="element()"/>
    <xsl:variable name="name" select="local-name($node)"/>
    <xsl:choose>
      <xsl:when test="$name = ('ForbiddenSet', 'Forbidden', 'FatalViolation')"><xsl:sequence select="'PROHIBITION'"/></xsl:when>
      <xsl:when test="$name = ('TechnologySet', 'Required', 'TechnologyRules')"><xsl:sequence select="'TECHNOLOGY'"/></xsl:when>
      <xsl:when test="$name = ('BooleanKernel', 'NAND', 'AND', 'OR', 'NOT')"><xsl:sequence select="'BOOLEAN_ALGEBRA'"/></xsl:when>
      <xsl:when test="$name = ('RefinementTypes', 'RefinementType')"><xsl:sequence select="'REFINEMENT_TYPE'"/></xsl:when>
      <xsl:when test="$name = ('DAG', 'Graph', 'Edge', 'Node')"><xsl:sequence select="'GRAPH_INVARIANT'"/></xsl:when>
      <xsl:when test="$name = ('Transformation', 'Transform')"><xsl:sequence select="'TRANSFORMATION'"/></xsl:when>
      <xsl:when test="$name = ('TruthLayer', 'TruthConstraint')"><xsl:sequence select="'TRUTH'"/></xsl:when>
      <xsl:when test="$name = ('Proof', 'ProofRecord')"><xsl:sequence select="'PROOF_ARTIFACT'"/></xsl:when>
      <xsl:when test="$name = ('Pipeline', 'Phase')"><xsl:sequence select="'EXECUTION_ORDER'"/></xsl:when>
      <xsl:when test="$name = ('Objective', 'AcceptanceFunction')"><xsl:sequence select="'ACCEPTANCE'"/></xsl:when>
      <xsl:when test="$name = ('Structure', 'CanonicalStructure')"><xsl:sequence select="'STRUCTURE'"/></xsl:when>
      <xsl:when test="$name = ('ComponentModel', 'ComponentContract')"><xsl:sequence select="'COMPONENT_CONTRACT'"/></xsl:when>
      <xsl:otherwise><xsl:sequence select="'GENERAL_CONSTRAINT'"/></xsl:otherwise>
    </xsl:choose>
  </xsl:function>

  <xsl:function name="fc:polarity" as="xs:string">
    <xsl:param name="node" as="element()"/>
    <xsl:variable name="text" select="lower-case(normalize-space(string($node)))"/>
    <xsl:choose>
      <xsl:when test="contains($text, 'forbidden') or contains($text, 'invalid') or contains($text, 'reject') or contains($text, '= 0') or contains($text, 'false')"><xsl:sequence select="'NEGATIVE'"/></xsl:when>
      <xsl:when test="contains($text, 'required') or contains($text, 'must') or contains($text, '= 1') or contains($text, 'true')"><xsl:sequence select="'POSITIVE'"/></xsl:when>
      <xsl:otherwise><xsl:sequence select="'NEUTRAL'"/></xsl:otherwise>
    </xsl:choose>
  </xsl:function>

  <xsl:function name="fc:normalized-expression" as="xs:string">
    <xsl:param name="node" as="element()"/>
    <xsl:variable name="raw" select="normalize-space(string-join($node//text(), ' '))"/>
    <xsl:sequence select="replace(replace(replace(replace(replace($raw, '⇒', ' implies '), '∀', ' forall '), '∈', ' in '), '≥', ' greater-than-or-equal '), '≤', ' less-than-or-equal ')"/>
  </xsl:function>

  <xsl:function name="fc:inverted-expression" as="xs:string">
    <xsl:param name="node" as="element()"/>
    <xsl:variable name="kind" select="fc:constraint-kind($node)"/>
    <xsl:variable name="expr" select="fc:normalized-expression($node)"/>
    <xsl:choose>
      <xsl:when test="$kind = 'PROHIBITION'"><xsl:sequence select="concat('reject-if(', $expr, ')')"/></xsl:when>
      <xsl:when test="$kind = 'ACCEPTANCE'"><xsl:sequence select="concat('accept-only-if(no-fatal-violation and ', $expr, ')')"/></xsl:when>
      <xsl:when test="$kind = 'EXECUTION_ORDER'"><xsl:sequence select="concat('block-next-until-complete(', $expr, ')')"/></xsl:when>
      <xsl:otherwise><xsl:sequence select="concat('require(', $expr, ')')"/></xsl:otherwise>
    </xsl:choose>
  </xsl:function>

  <xsl:function name="fc:hol-type" as="xs:string">
    <xsl:param name="kind" as="xs:string"/>
    <xsl:choose>
      <xsl:when test="$kind = 'BOOLEAN_ALGEBRA'"><xsl:sequence select="'bool'"/></xsl:when>
      <xsl:when test="$kind = 'EXECUTION_ORDER'"><xsl:sequence select="'nat =&gt; bool'"/></xsl:when>
      <xsl:when test="$kind = 'GRAPH_INVARIANT'"><xsl:sequence select="'graph =&gt; bool'"/></xsl:when>
      <xsl:otherwise><xsl:sequence select="'system_state =&gt; bool'"/></xsl:otherwise>
    </xsl:choose>
  </xsl:function>

  <xsl:function name="fc:lean-type" as="xs:string">
    <xsl:param name="kind" as="xs:string"/>
    <xsl:choose>
      <xsl:when test="$kind = 'BOOLEAN_ALGEBRA'"><xsl:sequence select="'Bool'"/></xsl:when>
      <xsl:when test="$kind = 'EXECUTION_ORDER'"><xsl:sequence select="'Nat → Prop'"/></xsl:when>
      <xsl:when test="$kind = 'GRAPH_INVARIANT'"><xsl:sequence select="'Graph → Prop'"/></xsl:when>
      <xsl:otherwise><xsl:sequence select="'SystemState → Prop'"/></xsl:otherwise>
    </xsl:choose>
  </xsl:function>

  <xsl:function name="fc:agda-type" as="xs:string">
    <xsl:param name="kind" as="xs:string"/>
    <xsl:choose>
      <xsl:when test="$kind = 'BOOLEAN_ALGEBRA'"><xsl:sequence select="'Bool'"/></xsl:when>
      <xsl:when test="$kind = 'EXECUTION_ORDER'"><xsl:sequence select="'ℕ → Set'"/></xsl:when>
      <xsl:when test="$kind = 'GRAPH_INVARIANT'"><xsl:sequence select="'Graph → Set'"/></xsl:when>
      <xsl:otherwise><xsl:sequence select="'SystemState → Set'"/></xsl:otherwise>
    </xsl:choose>
  </xsl:function>

  <xsl:function name="fc:iteration-transform" as="xs:string">
    <xsl:param name="index" as="xs:integer"/>
    <xsl:sequence select="('identity-preservation', 'double-negation-stability', 'conjunction-left-projection', 'conjunction-right-projection', 'implication-closure', 'contrapositive-check', 'reflexive-equality', 'symmetric-equality', 'transitive-equality', 'substitution-preservation', 'domain-restriction', 'codomain-preservation', 'state-transition-preservation', 'graph-edge-preservation', 'topological-order-preservation', 'refinement-strengthening', 'refinement-weakening-check', 'rejection-monotonicity', 'acceptance-soundness', 'cross-prover-correspondence')[$index]"/>
  </xsl:function>

  <!-- ROOT TEMPLATE -->
  <xsl:template match="/">
    <xsl:variable name="source-root" select="/*"/>
    <xsl:variable name="classified-tree" as="document-node()">
      <xsl:document>
        <fc:ClassifiedSource>
          <xsl:apply-templates select="$source-root" mode="fc:classify"/>
        </fc:ClassifiedSource>
      </xsl:document>
    </xsl:variable>
    <xsl:variable name="inverted-tree" as="document-node()">
      <xsl:document>
        <inv:InvertedConstraintTree>
          <xsl:apply-templates select="$source-root" mode="fc:invert"/>
        </inv:InvertedConstraintTree>
      </xsl:document>
    </xsl:variable>
    <xsl:variable name="registry" as="document-node()">
      <xsl:document>
        <inv:InvariantRegistry>
          <xsl:apply-templates select="$source-root" mode="fc:normalize"/>
        </inv:InvariantRegistry>
      </xsl:document>
    </xsl:variable>

    <FormalizationMachine project="{$project-name}" organization="{$organization}" stylesheet-version="{$stylesheet-version}" execution-policy="{$execution-policy}" formalization-order="{$formalization-order}" agda-iteration-multiplicity="{$agda-iteration-multiplicity}" strict-mode="{fc:boolean-text($strict-mode)}">
      <AuthorityBoundary>
        <Rule id="AUTH-001">XSLT may classify, normalize, invert, and emit proof obligations.</Rule>
        <Rule id="AUTH-002">XSLT may not assign VERIFIED status to an external proof.</Rule>
        <Rule id="AUTH-003">HOL verification requires successful HOL compilation.</Rule>
        <Rule id="AUTH-004">Lean verification requires successful Lean compilation.</Rule>
        <Rule id="AUTH-005">Agda verification requires successful Agda type checking.</Rule>
        <Rule id="AUTH-006">Cross-prover equivalence requires explicit correspondence proofs.</Rule>
        <Rule id="AUTH-007">Twenty generated iterations are obligations, not twenty verified proofs.</Rule>
      </AuthorityBoundary>
      <InputClassification><xsl:sequence select="$classified-tree/*"/></InputClassification>
      <ConstraintInversion>
        <InversionOrder>
          <Step index="1">Forbidden states and fatal violations</Step>
          <Step index="2">Truth and provenance restrictions</Step>
          <Step index="3">Technology exclusions</Step>
          <Step index="4">Required domain membership</Step>
          <Step index="5">Structural and graph invariants</Step>
          <Step index="6">Refinement predicates</Step>
          <Step index="7">Transformation conditions</Step>
          <Step index="8">Pipeline dependencies</Step>
          <Step index="9">Acceptance criteria</Step>
          <Step index="10">Generated output obligations</Step>
        </InversionOrder>
        <xsl:sequence select="$inverted-tree/*"/>
      </ConstraintInversion>
      <CanonicalInvariantRegistry><xsl:sequence select="$registry/*"/></CanonicalInvariantRegistry>
      <FormalizationPipeline>
        <HOLStage status="GENERATED_UNVERIFIED" target="HOL-family theorem prover">
          <xsl:apply-templates select="$registry//inv:Invariant" mode="fc:emit-hol"/>
        </HOLStage>
        <LeanStage status="GENERATED_UNVERIFIED" target="Lean 4">
          <xsl:apply-templates select="$registry//inv:Invariant" mode="fc:emit-lean"/>
        </LeanStage>
        <AgdaStage status="GENERATED_UNVERIFIED" target="Agda">
          <xsl:apply-templates select="$registry//inv:Invariant" mode="fc:emit-agda"/>
        </AgdaStage>
        <AgdaIterationMultiplicity count="{$agda-iteration-multiplicity}" semantics="DISTINCT_DERIVATION_OBLIGATIONS">
          <xsl:apply-templates select="$registry//inv:Invariant" mode="fc:emit-iterations"/>
        </AgdaIterationMultiplicity>
      </FormalizationPipeline>
      <CrossProverCorrespondence>
        <CorrespondenceRule id="CORR-001">HOL source proposition and Lean target proposition must share the same canonical invariant identifier.</CorrespondenceRule>
        <CorrespondenceRule id="CORR-002">Lean source proposition and Agda target proposition must share the same normalized predicate tree.</CorrespondenceRule>
        <CorrespondenceRule id="CORR-003">Identifier equality alone does not prove semantic equivalence.</CorrespondenceRule>
        <CorrespondenceRule id="CORR-004">Each translation must emit a source-to-target symbol map.</CorrespondenceRule>
        <CorrespondenceRule id="CORR-005">Unsupported constructs must remain UNRESOLVED.</CorrespondenceRule>
        <xsl:for-each select="$registry//inv:Invariant">
          <proof:CorrespondenceObligation invariant-id="{@id}" status="UNRESOLVED">
            <proof:HOLReference ref="{concat('hol-', @id)}"/>
            <proof:LeanReference ref="{concat('lean-', @id)}"/>
            <proof:AgdaReference ref="{concat('agda-', @id)}"/>
            <proof:RequiredStatement>HOL semantics, Lean semantics, and Agda semantics preserve the canonical normalized predicate.</proof:RequiredStatement>
          </proof:CorrespondenceObligation>
        </xsl:for-each>
      </CrossProverCorrespondence>
      <ExecutionSchedule>
        <Phase index="1" id="parse-source">Parse source XML with external entities disabled.</Phase>
        <Phase index="2" id="classify-source">Classify domains, rules, invariants, transformations, conflicts, and unresolved statements.</Phase>
        <Phase index="3" id="invert-constraints">Reorder the specification into rejection-first execution form.</Phase>
        <Phase index="4" id="normalize-invariants">Produce canonical typed invariant records.</Phase>
        <Phase index="5" id="emit-hol">Generate HOL declarations and proof obligations.</Phase>
        <Phase index="6" id="check-hol">Compile HOL artifacts and record actual prover results.</Phase>
        <Phase index="7" id="emit-lean">Generate Lean declarations from canonical invariants and HOL symbol mappings.</Phase>
        <Phase index="8" id="check-lean">Compile Lean artifacts without sorry or admit.</Phase>
        <Phase index="9" id="emit-agda">Generate Agda declarations from canonical invariants and Lean symbol mappings.</Phase>
        <Phase index="10" id="check-agda">Type-check Agda artifacts without postulates in verified paths.</Phase>
        <Phase index="11" id="derive-agda-20x">Generate twenty indexed derivation obligations per invariant.</Phase>
        <Phase index="12" id="check-correspondence">Check HOL-to-Lean and Lean-to-Agda semantic correspondence.</Phase>
      </ExecutionSchedule>
      <AuthorityDeclaration>
        <xsl:text>This FormalizationMachine artifact was generated by XSLT constraint inversion. Status of each phase depends on external prover results. XSLT authority is limited to CLASSIFICATION, INVERSION, NORMALIZATION, EMISSION. VERIFICATION authority is assigned to provers only upon successful compilation.</xsl:text>
      </AuthorityDeclaration>
    </FormalizationMachine>
  </xsl:template>

</xsl:stylesheet>
